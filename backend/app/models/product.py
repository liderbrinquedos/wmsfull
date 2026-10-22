import uuid
from sqlalchemy import Column, String, Integer
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo = Column(String, unique=True, nullable=False, index=True)
    referencia = Column(String, nullable=False)
    descricao = Column(String, nullable=False)
    qtd_embalagem = Column(Integer, nullable=False)  # unidades por caixa master
    localizacao = Column(String, nullable=False)      # ex: F102C
    estoque_caixas = Column(Integer, default=0)
    codigo_barras_master = Column(String, unique=True, nullable=False, index=True)
