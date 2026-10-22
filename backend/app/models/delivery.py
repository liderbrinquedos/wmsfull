import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime, Date, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nf_id = Column(String, ForeignKey("notas_fiscais.id"), nullable=False)
    motorista_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(
        Enum("entregue", "reagendado", name="delivery_status_enum"),
        nullable=False
    )
    foto_canhoto_url = Column(String, nullable=True)
    motivo_falha = Column(String, nullable=True)
    data_reagendamento = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nota_fiscal = relationship("NotaFiscal")
    motorista = relationship("User")
