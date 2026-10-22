import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, Enum, DateTime, Date,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    # `numero` sozinho nao identifica uma NF: dois fornecedores podem emitir a
    # NF 1234 no mesmo dia. A chave natural e `chave_nfe`; quando ela nao vier,
    # a combinacao (cnpj_fornecedor, serie, numero) desempata.
    __table_args__ = (
        UniqueConstraint(
            "cnpj_fornecedor", "serie", "numero",
            name="uq_nf_fornecedor_serie_numero",
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String, nullable=False, index=True)
    chave_nfe = Column(String(44), unique=True, nullable=True)
    serie = Column(String(10), nullable=True)
    cnpj_fornecedor = Column(String(14), nullable=True)
    fornecedor = Column(String, nullable=False)
    destinatario = Column(String, nullable=True)
    endereco = Column(String, nullable=True)
    data_emissao = Column(Date, nullable=True)
    status = Column(
        Enum(
            "pendente", "em_conferencia", "conferida",
            "em_entrega", "entregue", "reagendado",
            name="nf_status_enum"
        ),
        default="pendente",
        nullable=False
    )
    motorista_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    itens = relationship("NFItem", back_populates="nota_fiscal", cascade="all, delete-orphan")
    motorista = relationship("User", foreign_keys=[motorista_id])


class NFItem(Base):
    __tablename__ = "nf_itens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nf_id = Column(String, ForeignKey("notas_fiscais.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    qtd_nota = Column(Integer, nullable=False)          # unidades na nota
    qtd_embalagem = Column(Integer, nullable=False)     # unidades por caixa (snapshot)
    caixas_necessarias = Column(Integer, nullable=False) # ceil(qtd_nota / qtd_embalagem)
    caixas_lidas = Column(Integer, default=0)
    conferido = Column(Boolean, default=False)

    nota_fiscal = relationship("NotaFiscal", back_populates="itens")
    produto = relationship("Product")
