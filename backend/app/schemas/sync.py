from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


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
    """Uma NF de saida vinda do ERP.

    Sankhya: `codigo_empresa` = CODEMP, `nunota` = NUNOTA (unico no sistema),
    `numero` = NUMNOTA, `serie` = SERIENOTA, `chave_nfe` = CHAVENFE.
    """

    codigo_empresa: int = 1
    nunota: Optional[int] = None
    numero: str
    chave_nfe: Optional[str] = None
    serie: Optional[str] = None
    cliente: str
    cnpj_cliente: Optional[str] = None
    endereco: Optional[str] = None
    data_emissao: Optional[date] = None
    itens: list[NFItemSyncIn] = Field(default_factory=list)

    @field_validator("numero", "serie", mode="before")
    @classmethod
    def _para_texto(cls, valor):
        # NUMNOTA e SERIENOTA chegam como numero no ERP.
        if valor is None:
            return None
        return str(valor).strip() or None


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
