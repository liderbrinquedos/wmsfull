"""Painel de ingestao no admin.

Sem isso, "o sync rodou" e fe. A tela precisa responder: quando foi a ultima
execucao, quantos registros entraram, quantos erraram e se ha pedido manual
esperando o agente interno.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.models.sync import SyncRequest, SyncRun, SyncRunError
from app.models.user import User

router = APIRouter(prefix="/admin/sync", tags=["Admin - Sync"])

TIPOS = ("erp", "ficha", "localizacao")


def _serializar(run: SyncRun) -> dict:
    return {
        "id": run.id,
        "tipo": run.tipo,
        "origem": run.origem,
        "status": run.status,
        "iniciado_em": run.iniciado_em.isoformat() if run.iniciado_em else None,
        "finalizado_em": run.finalizado_em.isoformat() if run.finalizado_em else None,
        "lidos": run.lidos,
        "gravados": run.gravados,
        "erros": run.erros,
        "arquivo": run.arquivo,
        "mensagem": run.mensagem,
    }


def _serializar_pedido(pedido: SyncRequest) -> dict:
    return {
        "id": pedido.id,
        "status": pedido.status,
        "solicitado_em": pedido.solicitado_em.isoformat() if pedido.solicitado_em else None,
        "atendido_em": pedido.atendido_em.isoformat() if pedido.atendido_em else None,
        "run_id": pedido.run_id,
    }


@router.get("/status")
def status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    ultima_por_tipo = {}
    for tipo in TIPOS:
        run = (
            db.query(SyncRun)
            .filter(SyncRun.tipo == tipo)
            .order_by(SyncRun.iniciado_em.desc())
            .first()
        )
        ultima_por_tipo[tipo] = _serializar(run) if run else None

    pedido = (
        db.query(SyncRequest)
        .filter(SyncRequest.status == "pendente")
        .order_by(SyncRequest.solicitado_em)
        .first()
    )

    return {
        "ultima_por_tipo": ultima_por_tipo,
        "pedido_pendente": _serializar_pedido(pedido) if pedido else None,
        "consultado_em": datetime.utcnow().isoformat(),
    }


@router.post("/request", status_code=201)
def solicitar_sincronizacao(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """Grava um pedido; o agente interno consulta a cada 2 minutos (ADR-007)."""
    existente = (
        db.query(SyncRequest)
        .filter(SyncRequest.status == "pendente")
        .order_by(SyncRequest.solicitado_em)
        .first()
    )
    if existente:
        return _serializar_pedido(existente)

    pedido = SyncRequest(solicitado_por=current_user.id, status="pendente")
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return _serializar_pedido(pedido)


@router.get("/runs")
def listar_execucoes(
    tipo: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    query = db.query(SyncRun)
    if tipo:
        query = query.filter(SyncRun.tipo == tipo)
    runs = query.order_by(SyncRun.iniciado_em.desc()).limit(min(limit, 100)).all()
    return [_serializar(run) for run in runs]


@router.get("/runs/{run_id}")
def detalhar_execucao(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    run = db.get(SyncRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execucao de sync nao encontrada")

    erros = (
        db.query(SyncRunError)
        .filter(SyncRunError.run_id == run_id)
        .order_by(SyncRunError.entidade)
        .limit(500)
        .all()
    )
    detalhe = _serializar(run)
    detalhe["erros_detalhe"] = [
        {
            "entidade": erro.entidade,
            "chave": erro.chave,
            "campo": erro.campo,
            "motivo": erro.motivo,
        }
        for erro in erros
    ]
    return detalhe
