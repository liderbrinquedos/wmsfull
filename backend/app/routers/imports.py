"""Importacao das planilhas de referencia (fichas tecnicas e localizacao).

Sempre em duas etapas:

1. `POST /import/preview` - le, valida e devolve o relatorio sem gravar nada;
2. `POST /import/apply`   - aplica e registra em `sync_runs`.

O preview existe para ninguem aplicar um arquivo sem ver o efeito. O apply
reprocessa o arquivo enviado (nao guarda estado entre as chamadas).
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.planilhas import (
    LinhaFicha,
    LinhaLocalizacao,
    PlanilhaInvalida,
    ler_ficha,
    ler_localizacao,
)
from app.core.security import require_roles
from app.models.product import Product
from app.models.sync import SyncRun, SyncRunError
from app.models.user import User

router = APIRouter(prefix="/import", tags=["Importacao"])

TAMANHO_MAXIMO = 20 * 1024 * 1024  # 20 MB
AMOSTRA = 5


async def _ler_arquivo(arquivo: UploadFile) -> tuple[bytes, str]:
    nome = arquivo.filename or "planilha.xlsx"
    if not nome.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Envie o arquivo .xlsx original (nao converta para CSV)",
        )
    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(status_code=413, detail="Arquivo maior que 20 MB")
    return conteudo, nome


def _catalogo_por_codigo(db: Session) -> dict[str, Product]:
    return {produto.codigo: produto for produto in db.query(Product).all()}


def _catalogo_por_referencia(db: Session) -> dict[str, Product]:
    catalogo: dict[str, Product] = {}
    for produto in db.query(Product).all():
        catalogo.setdefault(produto.referencia, produto)
    return catalogo


def _relatorio(tipo: str, total: int) -> dict:
    return {
        "tipo": tipo,
        "linhas_lidas": total,
        "validas": 0,
        "rejeitadas": 0,
        "nao_encontradas": 0,
        "sem_alteracao": 0,
        "sem_localizacao": 0,
        "divergencias": [],
        "erros": [],
        "amostra": [],
    }


def _analisar_ficha(db: Session, linhas: list[LinhaFicha]) -> tuple[dict, list[dict]]:
    relatorio = _relatorio("ficha", len(linhas))
    catalogo = _catalogo_por_referencia(db)
    ajustes: list[dict] = []

    for item in linhas:
        produto = catalogo.get(item.ref)
        if produto is None:
            relatorio["nao_encontradas"] += 1
            relatorio["erros"].append(
                {"linha": item.linha, "chave": item.ref, "motivo": "REF. nao encontrada no catalogo"}
            )
            continue

        if item.cx_master is not None and produto.qtd_embalagem and item.cx_master != produto.qtd_embalagem:
            relatorio["divergencias"].append(
                {
                    "chave": item.ref,
                    "campo": "qtd_embalagem",
                    "planilha": item.cx_master,
                    "atual": produto.qtd_embalagem,
                }
            )

        campos: dict[str, str] = {}
        preservado = False

        # ERP prevalece sobre ficha para o EAN13 (spec 3, D4).
        if item.ean13 and item.ean13 != produto.ean13:
            if produto.ean13 and produto.ean13_origem == "erp":
                relatorio["erros"].append(
                    {
                        "linha": item.linha,
                        "chave": item.ref,
                        "motivo": "EAN13 do ERP preservado (planilha divergente)",
                    }
                )
                preservado = True
            else:
                campos["ean13"] = item.ean13

        # Correcao manual de EAN14 nao e sobrescrita por planilha.
        if item.dun14 and item.dun14 != produto.ean14:
            if produto.ean14 and produto.ean14_origem == "manual":
                relatorio["erros"].append(
                    {
                        "linha": item.linha,
                        "chave": item.ref,
                        "motivo": "EAN14 manual preservado (planilha divergente)",
                    }
                )
                preservado = True
            else:
                campos["ean14"] = item.dun14

        for problema in item.problemas:
            relatorio["erros"].append(
                {"linha": item.linha, "chave": item.ref, "motivo": problema}
            )

        if not campos:
            if item.problemas or preservado:
                relatorio["rejeitadas"] += 1
            else:
                relatorio["sem_alteracao"] += 1
            continue

        ajustes.append({"produto": produto, "campos": campos, "chave": item.ref})
        relatorio["validas"] += 1
        if len(relatorio["amostra"]) < AMOSTRA:
            relatorio["amostra"].append(
                {
                    "chave": item.ref,
                    "antes": {"ean13": produto.ean13, "ean14": produto.ean14},
                    "depois": {
                        "ean13": campos.get("ean13", produto.ean13),
                        "ean14": campos.get("ean14", produto.ean14),
                    },
                }
            )

    return relatorio, ajustes


def _analisar_localizacao(
    db: Session, linhas: list[LinhaLocalizacao]
) -> tuple[dict, list[dict]]:
    relatorio = _relatorio("localizacao", len(linhas))
    catalogo = _catalogo_por_codigo(db)
    ajustes: list[dict] = []

    for item in linhas:
        produto = catalogo.get(item.codigo)
        if produto is None:
            relatorio["nao_encontradas"] += 1
            relatorio["erros"].append(
                {"linha": item.linha, "chave": item.codigo, "motivo": "codigo nao encontrado no catalogo"}
            )
            continue

        if item.qtd_embalagem is not None and produto.qtd_embalagem and item.qtd_embalagem != produto.qtd_embalagem:
            relatorio["divergencias"].append(
                {
                    "chave": item.codigo,
                    "campo": "qtd_embalagem",
                    "planilha": item.qtd_embalagem,
                    "atual": produto.qtd_embalagem,
                }
            )

        for problema in item.problemas:
            relatorio["erros"].append(
                {"linha": item.linha, "chave": item.codigo, "motivo": problema}
            )

        if not item.localizacao:
            relatorio["sem_localizacao"] += 1
            continue
        if produto.localizacao == item.localizacao:
            relatorio["sem_alteracao"] += 1
            continue

        ajustes.append(
            {
                "produto": produto,
                "campos": {"localizacao": item.localizacao},
                "chave": item.codigo,
            }
        )
        relatorio["validas"] += 1
        if len(relatorio["amostra"]) < AMOSTRA:
            relatorio["amostra"].append(
                {
                    "chave": item.codigo,
                    "antes": {"localizacao": produto.localizacao},
                    "depois": {"localizacao": item.localizacao},
                }
            )

    return relatorio, ajustes


def _processar(
    db: Session, tipo: str, conteudo: bytes
) -> tuple[dict, list[dict]]:
    if tipo == "ficha":
        linhas = ler_ficha(conteudo)
        return _analisar_ficha(db, linhas)
    linhas_loc = ler_localizacao(conteudo)
    return _analisar_localizacao(db, linhas_loc)


def _aplicar(db: Session, tipo: str, arquivo: str, relatorio: dict, ajustes: list[dict]) -> SyncRun:
    run = SyncRun(
        tipo=tipo,
        origem="upload",
        arquivo=arquivo[:255],
        status="executando",
        lidos=relatorio["linhas_lidas"],
    )
    db.add(run)
    db.flush()

    aplicados = 0
    falhas = 0
    for ajuste in ajustes:
        produto: Product = ajuste["produto"]
        try:
            with db.begin_nested():
                for campo, valor in ajuste["campos"].items():
                    setattr(produto, campo, valor)
                    if campo == "ean13":
                        produto.ean13_origem = "ficha"
                    elif campo == "ean14":
                        produto.ean14_origem = "ficha"
            aplicados += 1
        except IntegrityError as exc:
            falhas += 1
            motivo = "codigo de barras ja usado por outro produto"
            if "ean14" not in str(exc.orig):
                motivo = "violacao de integridade ao gravar"
            db.add(
                SyncRunError(
                    run_id=run.id,
                    entidade="produto",
                    chave=str(ajuste["chave"])[:64],
                    campo="ean13/ean14",
                    motivo=motivo,
                )
            )

    total_erros = len(relatorio["erros"]) + falhas
    for erro in relatorio["erros"][:200]:
        db.add(
            SyncRunError(
                run_id=run.id,
                entidade="linha",
                chave=str(erro.get("chave") or "")[:64],
                campo=str(erro.get("linha")),
                motivo=str(erro["motivo"])[:255],
            )
        )

    run.gravados = aplicados
    run.erros = total_erros
    run.status = "ok" if total_erros == 0 else ("parcial" if aplicados else "erro")
    run.finalizado_em = datetime.utcnow()
    run.mensagem = (
        f"{relatorio['validas']} linhas aplicaveis, {aplicados} gravadas, "
        f"{relatorio['nao_encontradas']} nao encontradas, "
        f"{len(relatorio['divergencias'])} divergencias de quantidade"
    )
    return run


@router.post("/preview")
async def preview(
    tipo: str = Form(..., description="ficha | localizacao"),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    if tipo not in ("ficha", "localizacao"):
        raise HTTPException(status_code=400, detail="tipo deve ser 'ficha' ou 'localizacao'")

    conteudo, nome = await _ler_arquivo(arquivo)
    try:
        relatorio, _ = _processar(db, tipo, conteudo)
    except PlanilhaInvalida as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    relatorio["arquivo"] = nome
    relatorio["aplicado"] = False
    return relatorio


@router.post("/apply")
async def aplicar(
    tipo: str = Form(..., description="ficha | localizacao"),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    if tipo not in ("ficha", "localizacao"):
        raise HTTPException(status_code=400, detail="tipo deve ser 'ficha' ou 'localizacao'")

    conteudo, nome = await _ler_arquivo(arquivo)
    try:
        relatorio, ajustes = _processar(db, tipo, conteudo)
    except PlanilhaInvalida as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not ajustes:
        relatorio["arquivo"] = nome
        relatorio["aplicado"] = False
        relatorio["run_id"] = None
        relatorio["mensagem"] = "nenhuma alteracao a aplicar"
        return relatorio

    run = _aplicar(db, tipo, nome, relatorio, ajustes)
    db.commit()
    db.refresh(run)

    relatorio["arquivo"] = nome
    relatorio["aplicado"] = True
    relatorio["run_id"] = run.id
    relatorio["gravados"] = run.gravados
    relatorio["status"] = run.status
    return relatorio
