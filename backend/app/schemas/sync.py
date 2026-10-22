from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


# ── Agente -> API ────────────────────────────────────────────────


class ProdutoSyncIn(BaseModel):
    codigo: str
    referencia: Optional[str] = None
    descricao: Optional[str] = None
    ean13: Optional[str] = None
    qtd_embalagem: Optional[int] = None


class ProdutosSyncIn(BaseModel):
    # Quando informado, as contagens sao acumuladas na execucao existente.
    run_id: Optional[str] = None
    produtos: list[ProdutoSyncIn] = Field(default_factory=list)


class NFItemSyncIn(BaseModel):
    codigo: str = Field(description="products.codigo")
    qtd_nota: int
    qtd_embalagem: Optional[int] = None


class NFSyncIn(BaseModel):
    numero: str
    chave_nfe: Optional[str] = None
    serie: Optional[str] = None
    cnpj_fornecedor: Optional[str] = None
    fornecedor: str
    destinatario: Optional[str] = None
    endereco: Optional[str] = None
    data_emissao: Optional[date] = None
    itens: list[NFItemSyncIn] = Field(default_factory=list)


class NFsSyncIn(BaseModel):
    run_id: Optional[str] = None
    nfs: list[NFSyncIn] = Field(default_factory=list)


class SyncRunIn(BaseModel):
    tipo: str = "erp"
    origem: str = "agenda"


class SyncRunFinishIn(BaseModel):
    status: str = "ok"
    lidos: int = 0
    gravados: int = 0
    erros: int = 0
    mensagem: Optional[str] = None
    request_id: Optional[str] = None
