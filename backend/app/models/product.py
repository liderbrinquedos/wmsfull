import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo = Column(String, unique=True, nullable=False, index=True)
    referencia = Column(String, nullable=False)
    descricao = Column(String, nullable=False)

    # Unidades por caixa master. O ERP prevalece; a planilha de localizacao serve
    # so para conferencia. Default 1 evita divisao por zero em caixas_necessarias.
    qtd_embalagem = Column(Integer, nullable=False, default=1)

    # Endereco fisico. Vem da planilha de referencia, nunca do ERP.
    # Nulo = produto ainda sem endereco (1.381 casos na planilha de 2026-10).
    localizacao = Column(String, nullable=True)

    estoque_caixas = Column(Integer, default=0)

    # EAN13 = unidade (vem do ERP). EAN14 = caixa master / DUN14 (vem da ficha
    # tecnica ou do cadastro manual). O sync do ERP nunca escreve ean14.
    ean13 = Column(String(13), unique=True, nullable=True)
    ean14 = Column(String(14), unique=True, nullable=True)
    ean13_origem = Column(String(8), nullable=True)  # erp | ficha | manual
    ean14_origem = Column(String(8), nullable=True)  # ficha | manual

    # Legado: codigo unico da caixa, anterior ao ean14. Continua aceito na
    # bipagem para nao quebrar dados antigos.
    codigo_barras_master = Column(String, unique=True, nullable=True, index=True)

    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
