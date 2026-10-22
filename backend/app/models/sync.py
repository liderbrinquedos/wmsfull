"""Tabelas de controle da ingestao de dados.

Um unico par `sync_runs` / `sync_run_errors` atende os tres caminhos de entrada
(ERP, ficha tecnica, planilha de localizacao); o que muda e o campo `tipo`.
`sync_requests` e o pedido de sincronizacao manual: a UI grava, o agente interno
consulta por polling (ADR-007).
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class SyncRun(Base):
    __tablename__ = "sync_runs"
    __table_args__ = (
        Index("ix_sync_runs_tipo_iniciado", "tipo", "iniciado_em"),
        Index("ix_sync_runs_status", "status"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo = Column(String(16), nullable=False)      # erp | ficha | localizacao
    origem = Column(String(16), nullable=False, default="agenda")  # agenda | manual | upload
    status = Column(String(16), nullable=False, default="executando")  # executando | ok | parcial | erro

    iniciado_em = Column(DateTime, default=datetime.utcnow, nullable=False)
    finalizado_em = Column(DateTime, nullable=True)

    lidos = Column(Integer, nullable=False, default=0)
    gravados = Column(Integer, nullable=False, default=0)
    erros = Column(Integer, nullable=False, default=0)

    arquivo = Column(String(255), nullable=True)   # nome do arquivo, no import
    mensagem = Column(Text, nullable=True)
    solicitado_por = Column(String, ForeignKey("users.id"), nullable=True)

    erros_detalhe = relationship(
        "SyncRunError", back_populates="run", cascade="all, delete-orphan"
    )


class SyncRunError(Base):
    __tablename__ = "sync_run_errors"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("sync_runs.id"), nullable=False, index=True)
    entidade = Column(String(32), nullable=False)  # produto | nf | item | linha
    chave = Column(String(64), nullable=True)      # codigo, REF. ou numero da linha
    campo = Column(String(32), nullable=True)
    motivo = Column(String(255), nullable=False)

    run = relationship("SyncRun", back_populates="erros_detalhe")


class SyncRequest(Base):
    __tablename__ = "sync_requests"
    __table_args__ = (Index("ix_sync_requests_status_solicitado", "status", "solicitado_em"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    solicitado_por = Column(String, ForeignKey("users.id"), nullable=True)
    solicitado_em = Column(DateTime, default=datetime.utcnow, nullable=False)
    atendido_em = Column(DateTime, nullable=True)
    run_id = Column(String, ForeignKey("sync_runs.id"), nullable=True)
    status = Column(String(16), nullable=False, default="pendente")  # pendente | atendido | cancelado
