"""Ingestao de dados do ERP (ADR-007).

Autenticacao separada do JWT de usuario: header `X-Sync-Key`, comparado em tempo
constante com `settings.SYNC_API_KEY`. O app publico nunca inicia conexao para a
rede interna; quem chama estes endpoints e o agente `wmsfull-sync`.

Regras de posse (spec secao 3, D4):
  - o sync escreve identidade, ean13 e qtd_embalagem;
  - o sync NUNCA escreve localizacao, estoque_caixas nem ean14;
  - NF fora de `pendente` e ignorada (nao regride status nem caixas_lidas).
"""
import math
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.barcodes import ean13_valido
from app.core.config import settings
from app.core.database import get_db
from app.models.nota_fiscal import NFItem, NotaFiscal
from app.models.product import Product
from app.models.sync import SyncRequest, SyncRun, SyncRunError
from app.schemas.sync import (
    NFSyncIn,
    NFsSyncIn,
    ProdutoSyncIn,
    ProdutosSyncIn,
    SyncRunFinishIn,
    SyncRunIn,
)

router = APIRouter(prefix="/sync", tags=["Sync"])

MAX_ERROS_POR_LOTE = 200
STATUS_VALIDOS = {"ok", "parcial", "erro"}


class _Skip(Exception):
    """Item recusado: vira linha em sync_run_errors, o resto do lote continua."""


def require_sync_key(x_sync_key: Optional[str] = Header(default=None, alias="X-Sync-Key")):
    if not settings.SYNC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Sincronizacao desabilitada: SYNC_API_KEY nao configurada",
        )
    if not x_sync_key or not secrets.compare_digest(x_sync_key, settings.SYNC_API_KEY):
        raise HTTPException(status_code=401, detail="X-Sync-Key invalida")


def _motivo_integridade(exc: IntegrityError) -> str:
    texto = str(exc.orig)
    if "ean13" in texto:
        return "ean13 ja cadastrado em outro produto"
    if "ean14" in texto:
        return "ean14 ja cadastrado em outro produto"
    if "chave_nfe" in texto:
        return "chave_nfe ja cadastrada em outra nota"
    if "uq_nf_nunota" in texto:
        return "NUNOTA ja cadastrado em outra nota"
    if "uq_nf_empresa_serie_numero" in texto:
        return "ja existe nota com esta empresa, serie e numero"
    if "products_codigo" in texto or "ix_products_codigo" in texto:
        return "codigo de produto duplicado"
    return "violacao de integridade no banco"


def _abrir_execucao(db: Session, run_id: Optional[str]) -> SyncRun:
    if run_id:
        run = db.get(SyncRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Execucao de sync nao encontrada")
        return run
    run = SyncRun(tipo="erp", origem="manual", status="executando")
    db.add(run)
    db.flush()
    return run


def _gravar_produto(db: Session, item: ProdutoSyncIn) -> None:
    produto = db.query(Product).filter(Product.codigo == item.codigo).first()

    if produto is None:
        if not item.referencia or not item.descricao:
            raise _Skip("produto novo exige referencia e descricao")
        produto = Product(
            codigo=item.codigo,
            referencia=item.referencia,
            descricao=item.descricao,
            qtd_embalagem=1,
            estoque_caixas=0,
        )
        db.add(produto)

    # ERP sobrescreve identidade quando traz valor; nunca mexe em localizacao,
    # estoque_caixas ou ean14.
    if item.referencia:
        produto.referencia = item.referencia
    if item.descricao:
        produto.descricao = item.descricao

    if item.qtd_embalagem is not None:
        if item.qtd_embalagem < 1:
            raise _Skip("qtd_embalagem invalida (minimo 1)")
        produto.qtd_embalagem = item.qtd_embalagem

    if item.ean13:
        if not ean13_valido(item.ean13):
            raise _Skip("ean13 invalido (tamanho ou digito verificador)")
        produto.ean13 = item.ean13
        produto.ean13_origem = "erp"


def _localizar_nf(db: Session, item: NFSyncIn) -> tuple[Optional[NotaFiscal], str]:
    """Devolve a nota e por qual chave ela foi encontrada."""
    # 1. NUNOTA (Sankhya): numero unico do sistema, o que evita duplicidade.
    if item.nunota is not None:
        nf = db.query(NotaFiscal).filter(NotaFiscal.nunota == item.nunota).first()
        if nf:
            return nf, "nunota"

    # 2. Chave de acesso da NF-e.
    if item.chave_nfe:
        nf = db.query(NotaFiscal).filter(NotaFiscal.chave_nfe == item.chave_nfe).first()
        if nf:
            return nf, "chave_nfe"

    # 3. Identidade da SEFAZ: empresa + serie + numero.
    if item.serie:
        nf = (
            db.query(NotaFiscal)
            .filter(
                NotaFiscal.codigo_empresa == item.codigo_empresa,
                NotaFiscal.serie == item.serie,
                NotaFiscal.numero == item.numero,
            )
            .first()
        )
        if nf:
            return nf, "empresa/serie/numero"
        return None, "nova"

    # 4. Sem serie: so da para desempatar se nao houver mais de uma candidata.
    candidatas = (
        db.query(NotaFiscal)
        .filter(
            NotaFiscal.codigo_empresa == item.codigo_empresa,
            NotaFiscal.numero == item.numero,
        )
        .all()
    )
    if len(candidatas) > 1:
        raise _Skip(
            "numero de NF repetido em series diferentes: envie nunota, chave_nfe ou serie"
        )
    if candidatas:
        return candidatas[0], "empresa/numero"
    return None, "nova"


def _conflitos_identidade(nf: NotaFiscal, item: NFSyncIn) -> list[str]:
    """O que difere entre a nota existente e a que chegou.

    Identidade nao se reescreve: se o NUNOTA aponta para uma nota de outra empresa
    ou de outro numero, o payload esta errado. Corrigir em silencio trocaria a nota
    que o operador esta conferindo.
    """
    conflitos = []
    if nf.codigo_empresa != item.codigo_empresa:
        conflitos.append("empresa")
    if nf.numero != item.numero:
        conflitos.append("numero")
    if nf.serie and item.serie and nf.serie != item.serie:
        conflitos.append("serie")
    if nf.chave_nfe and item.chave_nfe and nf.chave_nfe != item.chave_nfe:
        conflitos.append("chave_nfe")
    if nf.nunota and item.nunota and nf.nunota != item.nunota:
        conflitos.append("nunota")
    return conflitos


def _gravar_nf(db: Session, item: NFSyncIn) -> list[str]:
    nf, como = _localizar_nf(db, item)

    if nf is not None and nf.status != "pendente":
        # Nao regride quem ja esta em conferencia/entrega: a operacao manda.
        raise _Skip(f"NF {nf.numero} esta em '{nf.status}': sync ignorado")

    if nf is None:
        nf = NotaFiscal(
            numero=item.numero,
            codigo_empresa=item.codigo_empresa,
            nunota=item.nunota,
            serie=item.serie,
            chave_nfe=item.chave_nfe,
            cliente=item.cliente,
            status="pendente",
        )
        db.add(nf)
        db.flush()
    else:
        # Identidade nao se reescreve; so completa o que estava vazio.
        conflitos = _conflitos_identidade(nf, item)
        if conflitos:
            raise _Skip(
                f"nota localizada por {como} mas {', '.join(conflitos)} nao confere(m): "
                "identidade nao pode ser alterada"
            )
        if not nf.serie:
            nf.serie = item.serie
        if not nf.nunota:
            nf.nunota = item.nunota
        if not nf.chave_nfe:
            nf.chave_nfe = item.chave_nfe

    nf.cliente = item.cliente
    if item.endereco is not None:
        nf.endereco = item.endereco
    if item.data_emissao is not None:
        nf.data_emissao = item.data_emissao
    if item.cnpj_cliente:
        nf.cnpj_cliente = item.cnpj_cliente

    # A NF ainda esta pendente, entao nada foi bipado: substituir os itens e seguro.
    db.query(NFItem).filter(NFItem.nf_id == nf.id).delete()
    db.flush()

    problemas: list[str] = []
    for item_nf in item.itens:
        produto = db.query(Product).filter(Product.codigo == item_nf.codigo).first()
        if produto is None:
            problemas.append(f"item {item_nf.codigo}: produto nao cadastrado")
            continue

        qtd_emb = item_nf.qtd_embalagem or produto.qtd_embalagem or 1
        if qtd_emb < 1:
            problemas.append(f"item {item_nf.codigo}: qtd_embalagem invalida")
            continue
        if item_nf.qtd_nota < 0:
            problemas.append(f"item {item_nf.codigo}: qtd_nota negativa")
            continue

        db.add(
            NFItem(
                nf_id=nf.id,
                product_id=produto.id,
                qtd_nota=item_nf.qtd_nota,
                qtd_embalagem=qtd_emb,
                caixas_necessarias=math.ceil(item_nf.qtd_nota / qtd_emb),
                caixas_lidas=0,
                conferido=False,
            )
        )
    return problemas


def _registrar_erros(
    db: Session, run: SyncRun, entidade: str, erros: list[tuple[Optional[str], str]]
) -> None:
    for chave, motivo in erros[:MAX_ERROS_POR_LOTE]:
        db.add(SyncRunError(run_id=run.id, entidade=entidade, chave=chave, motivo=motivo[:255]))


def _processar_lote(db: Session, run: SyncRun, entidade: str, itens, gravar) -> dict:
    gravados = 0
    erros: list[tuple[Optional[str], str]] = []

    for item in itens:
        chave = getattr(item, "codigo", None) or getattr(item, "numero", None)
        try:
            with db.begin_nested():
                problemas = gravar(db, item)
            gravados += 1
            for motivo in problemas or []:
                erros.append((chave, motivo))
        except _Skip as exc:
            erros.append((chave, str(exc)))
        except IntegrityError as exc:
            erros.append((chave, _motivo_integridade(exc)))

    run.lidos += len(itens)
    run.gravados += gravados
    run.erros += len(erros)
    _registrar_erros(db, run, entidade, erros)

    return {
        "run_id": run.id,
        "lidos": len(itens),
        "gravados": gravados,
        "erros": [{"chave": chave, "motivo": motivo} for chave, motivo in erros],
    }


@router.post("/runs")
def abrir_execucao(
    payload: SyncRunIn,
    db: Session = Depends(get_db),
    _=Depends(require_sync_key),
):
    """O agente abre a execucao, envia os lotes e fecha em /runs/{id}/finish."""
    run = SyncRun(tipo=payload.tipo, origem=payload.origem, status="executando")
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"id": run.id, "tipo": run.tipo, "origem": run.origem, "status": run.status}


@router.post("/produtos")
def sincronizar_produtos(
    payload: ProdutosSyncIn,
    db: Session = Depends(get_db),
    _=Depends(require_sync_key),
):
    run = _abrir_execucao(db, payload.run_id)
    resultado = _processar_lote(db, run, "produto", payload.produtos, _gravar_produto)
    db.commit()
    return resultado


@router.post("/nf")
def sincronizar_nfs(
    payload: NFsSyncIn,
    db: Session = Depends(get_db),
    _=Depends(require_sync_key),
):
    run = _abrir_execucao(db, payload.run_id)
    resultado = _processar_lote(db, run, "nf", payload.nfs, _gravar_nf)
    db.commit()
    return resultado


@router.get("/requests/pending")
def pedido_pendente(
    db: Session = Depends(get_db),
    _=Depends(require_sync_key),
):
    """Pedido de sincronizacao manual mais antigo. 204 = nada pendente."""
    pedido = (
        db.query(SyncRequest)
        .filter(SyncRequest.status == "pendente")
        .order_by(SyncRequest.solicitado_em)
        .first()
    )
    if not pedido:
        return Response(status_code=204)
    return {"id": pedido.id, "solicitado_em": pedido.solicitado_em.isoformat()}


@router.post("/runs/{run_id}/finish")
def fechar_execucao(
    run_id: str,
    payload: SyncRunFinishIn,
    db: Session = Depends(get_db),
    _=Depends(require_sync_key),
):
    run = db.get(SyncRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execucao de sync nao encontrada")

    agora = datetime.utcnow()
    run.status = payload.status if payload.status in STATUS_VALIDOS else "erro"
    run.finalizado_em = agora
    if payload.lidos:
        run.lidos = payload.lidos
    if payload.gravados:
        run.gravados = payload.gravados
    if payload.erros:
        run.erros = payload.erros
    if payload.mensagem:
        run.mensagem = payload.mensagem[:2000]

    pedido = None
    if payload.request_id:
        pedido = db.get(SyncRequest, payload.request_id)
        if pedido and pedido.status == "pendente":
            pedido.status = "atendido"
            pedido.atendido_em = agora
            pedido.run_id = run.id

    db.commit()
    return {"id": run.id, "status": run.status, "pedido_atendido": bool(pedido)}
