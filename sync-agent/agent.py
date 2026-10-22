"""Agente de ingestao do WMSFull (ADR-007).

Roda no servidor interno, onde existe acesso ao ERP e saida para a internet.
Le o ERP (somente SELECT) e empurra os dados para a API publica por HTTPS.

Nada aqui abre porta: o agente so faz requisicoes de saida, como um navegador.

Modos de agendamento:
  - horarios fixos (SYNC_HORARIOS) com recuperacao de horario perdido;
  - pedido manual: consulta /sync/requests/pending a cada SYNC_INTERVALO_SEGUNDOS.
"""
from __future__ import annotations

import logging
import os
import sys
import time
from datetime import date, datetime, time as hora, timedelta

import requests

from sources import FonteERP, criar_fonte

log = logging.getLogger("wmsfull-sync")


# ── Configuracao ─────────────────────────────────────────────────


def env_int(nome: str, padrao: int) -> int:
    try:
        return int(os.environ.get(nome, padrao))
    except ValueError:
        return padrao


def env_bool(nome: str, padrao: bool) -> bool:
    valor = os.environ.get(nome)
    if valor is None:
        return padrao
    return valor.strip().lower() in ("1", "true", "sim", "yes", "on")


def env_obrigatoria(nome: str) -> str:
    valor = os.environ.get(nome)
    if not valor:
        raise SystemExit(f"Variavel de ambiente obrigatoria ausente: {nome}")
    return valor


def parse_horarios(texto: str) -> list[hora]:
    horarios = []
    for pedaco in texto.split(","):
        pedaco = pedaco.strip()
        if not pedaco:
            continue
        try:
            horas, minutos = pedaco.split(":")
            horarios.append(hora(int(horas), int(minutos)))
        except ValueError:
            raise SystemExit(f"Horario invalido em SYNC_HORARIOS: {pedaco!r}")
    return sorted(horarios)


def configurar_log() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )


# ── Cliente da API publica ───────────────────────────────────────


class ClienteAPI:
    def __init__(self, base_url: str, chave: str, timeout: int = 180):
        self.base = base_url.rstrip("/")
        self.timeout = timeout
        self.sessao = requests.Session()
        self.sessao.headers["X-Sync-Key"] = chave

    def _post(self, caminho: str, payload: dict) -> dict:
        resposta = self.sessao.post(f"{self.base}{caminho}", json=payload, timeout=self.timeout)
        if resposta.status_code >= 400:
            raise requests.HTTPError(
                f"HTTP {resposta.status_code} em {caminho}: {resposta.text[:300]}"
            )
        return resposta.json() if resposta.content else {}

    def pedido_pendente(self) -> dict | None:
        resposta = self.sessao.get(f"{self.base}/sync/requests/pending", timeout=30)
        if resposta.status_code == 204:
            return None
        resposta.raise_for_status()
        return resposta.json()

    def abrir_execucao(self, origem: str) -> str:
        return self._post("/sync/runs", {"tipo": "erp", "origem": origem})["id"]

    def enviar_produtos(self, run_id: str, produtos: list[dict]) -> dict:
        return self._post("/sync/produtos", {"run_id": run_id, "produtos": produtos})

    def enviar_notas(self, run_id: str, notas: list[dict]) -> dict:
        return self._post("/sync/nf", {"run_id": run_id, "nfs": notas})

    def finalizar(self, run_id: str, payload: dict) -> dict:
        return self._post(f"/sync/runs/{run_id}/finish", payload)


# ── Execucao ─────────────────────────────────────────────────────


def _lotes(itens: list, tamanho: int):
    for inicio in range(0, len(itens), tamanho):
        yield itens[inicio : inicio + tamanho]


def executar(
    cliente: ClienteAPI,
    fonte: FonteERP,
    origem: str,
    request_id: str | None,
    janela_dias: int,
    tamanho_lote: int,
) -> dict:
    """Uma execucao completa: abre o run, envia os lotes e fecha com as contagens."""
    run_id = cliente.abrir_execucao(origem)
    log.info("execucao %s aberta (origem=%s)", run_id, origem)

    lidos = gravados = erros = 0
    mensagem = None
    status = "ok"

    try:
        produtos = [p.para_payload() for p in fonte.produtos()]
        log.info("%s produtos lidos do ERP", len(produtos))
        for lote in _lotes(produtos, tamanho_lote):
            resultado = cliente.enviar_produtos(run_id, lote)
            lidos += resultado["lidos"]
            gravados += resultado["gravados"]
            erros += len(resultado["erros"])
            _log_erros("produto", resultado["erros"])

        desde = date.today() - timedelta(days=janela_dias)
        notas = [n.para_payload() for n in fonte.notas(desde)]
        log.info("%s notas lidas do ERP (desde %s)", len(notas), desde.isoformat())
        for lote in _lotes(notas, tamanho_lote):
            resultado = cliente.enviar_notas(run_id, lote)
            lidos += resultado["lidos"]
            gravados += resultado["gravados"]
            erros += len(resultado["erros"])
            _log_erros("nf", resultado["erros"])

    except requests.HTTPError as exc:
        status = "erro"
        mensagem = f"falha ao falar com a API: {exc}"
        log.error(mensagem)
    except Exception as exc:  # erro de leitura do ERP, driver, conexao...
        status = "erro"
        mensagem = f"{type(exc).__name__}: {exc}"
        log.exception("falha na leitura do ERP")

    if status == "ok" and erros:
        status = "parcial"

    try:
        cliente.finalizar(
            run_id,
            {
                "status": status,
                "lidos": lidos,
                "gravados": gravados,
                "erros": erros,
                "mensagem": mensagem,
                "request_id": request_id,
            },
        )
    except requests.HTTPError as exc:
        log.error("nao foi possivel fechar a execucao %s: %s", run_id, exc)

    resumo = {
        "run_id": run_id,
        "status": status,
        "lidos": lidos,
        "gravados": gravados,
        "erros": erros,
    }
    log.info("execucao encerrada: %s", resumo)
    return resumo


def _log_erros(entidade: str, erros: list[dict]) -> None:
    for erro in erros[:20]:
        log.warning("  %s %s: %s", entidade, erro.get("chave"), erro.get("motivo"))
    if len(erros) > 20:
        log.warning("  ... e mais %s erros (ver painel do admin)", len(erros) - 20)


def horario_devido(horarios: list[hora], ultima: datetime | None) -> bool:
    """True se algum horario do dia ja passou e ainda nao executamos depois dele."""
    agora = datetime.now()
    for alvo_hora in horarios:
        alvo = datetime.combine(agora.date(), alvo_hora)
        if agora >= alvo and (ultima is None or ultima < alvo):
            return True
    return False


def main() -> None:
    configurar_log()

    cliente = ClienteAPI(
        base_url=env_obrigatoria("WMS_API_URL"),
        chave=env_obrigatoria("SYNC_API_KEY"),
    )
    fonte = criar_fonte()

    horarios = parse_horarios(os.environ.get("SYNC_HORARIOS", "06:00,12:00,18:00"))
    intervalo = env_int("SYNC_INTERVALO_SEGUNDOS", 120)
    janela_dias = env_int("ERP_JANELA_DIAS", 3)
    tamanho_lote = env_int("SYNC_LOTE", 500)

    log.info(
        "agente iniciado: api=%s horarios=%s intervalo=%ss janela=%sd lote=%s",
        cliente.base,
        ",".join(h.strftime("%H:%M") for h in horarios),
        intervalo,
        janela_dias,
        tamanho_lote,
    )

    ultima_agenda: datetime | None = None

    if env_bool("SYNC_AO_INICIAR", True):
        executar(cliente, fonte, "agenda", None, janela_dias, tamanho_lote)
        ultima_agenda = datetime.now()

    while True:
        try:
            pedido = cliente.pedido_pendente()
            if pedido:
                log.info("pedido manual recebido: %s", pedido["id"])
                executar(cliente, fonte, "manual", pedido["id"], janela_dias, tamanho_lote)
                ultima_agenda = datetime.now()
            elif horario_devido(horarios, ultima_agenda):
                executar(cliente, fonte, "agenda", None, janela_dias, tamanho_lote)
                ultima_agenda = datetime.now()
        except requests.HTTPError as exc:
            log.error("falha de comunicacao com a API: %s", exc)
        except Exception:
            log.exception("erro inesperado no ciclo")

        time.sleep(intervalo)


if __name__ == "__main__":
    main()
