from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date
import math


# ── Auth ─────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    nome: str
    email: str
    perfil: str
    ativo: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: str


class UserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil: Optional[str] = None
    ativo: Optional[bool] = None


# ── Produtos ─────────────────────────────────────────────────────
class ProductOut(BaseModel):
    id: str
    codigo: str
    referencia: str
    descricao: str
    qtd_embalagem: int
    localizacao: Optional[str] = None
    estoque_caixas: int
    ean13: Optional[str] = None
    ean14: Optional[str] = None
    ean13_origem: Optional[str] = None
    ean14_origem: Optional[str] = None
    codigo_barras_master: Optional[str] = None

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    localizacao: Optional[str] = None
    estoque_caixas: Optional[int] = None


# ── Nota Fiscal ──────────────────────────────────────────────────
class NFItemOut(BaseModel):
    id: str
    product_id: str
    qtd_nota: int
    qtd_embalagem: int
    caixas_necessarias: int
    caixas_lidas: int
    conferido: bool
    produto: Optional[ProductOut] = None

    class Config:
        from_attributes = True


class NFOut(BaseModel):
    id: str
    numero: str
    fornecedor: str
    destinatario: Optional[str]
    endereco: Optional[str]
    status: str
    motorista_id: Optional[str]
    motorista: Optional[UserOut] = None
    created_at: datetime
    itens: list[NFItemOut] = []

    class Config:
        from_attributes = True


class ScanRequest(BaseModel):
    codigo_barras: str


class AssignMotoristaRequest(BaseModel):
    motorista_id: str


# ── Delivery ─────────────────────────────────────────────────────
class DeliveryOut(BaseModel):
    id: str
    nf_id: str
    motorista_id: str
    status: str
    foto_canhoto_url: Optional[str]
    motivo_falha: Optional[str]
    data_reagendamento: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True


class RescheduleRequest(BaseModel):
    motivo: str
    data_reagendamento: date


Token.model_rebuild()
