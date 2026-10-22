import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String, unique=True, nullable=False, index=True)
    fornecedor = Column(String, nullable=False)
    destinatario = Column(String, nullable=True)
    endereco = Column(String, nullable=True)
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
