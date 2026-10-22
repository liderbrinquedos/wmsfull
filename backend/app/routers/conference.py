import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.nota_fiscal import NotaFiscal, NFItem
from app.models.product import Product
from app.models.user import User
from app.schemas.schemas import NFOut, ScanRequest, AssignMotoristaRequest

router = APIRouter(prefix="/conference", tags=["Conferência"])


@router.get("/nf", response_model=list[NFOut])
def list_nfs(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(NotaFiscal)
    if status:
        query = query.filter(NotaFiscal.status == status)
    return query.order_by(NotaFiscal.created_at.desc()).all()


@router.get("/nf/{nf_id}", response_model=NFOut)
def get_nf(
    nf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="Nota Fiscal não encontrada")
    return nf


@router.post("/nf/{nf_id}/start", response_model=NFOut)
def start_conference(
    nf_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "operador"))
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    if nf.status not in ("pendente",):
        raise HTTPException(status_code=400, detail=f"NF não pode ser iniciada. Status atual: {nf.status}")
    nf.status = "em_conferencia"
    db.commit()
    db.refresh(nf)
    return nf


@router.post("/nf/{nf_id}/scan", response_model=NFOut)
def scan_barcode(
    nf_id: str,
    body: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor", "operador"))
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    if nf.status != "em_conferencia":
        raise HTTPException(status_code=400, detail="NF não está em conferência")

    # Localizar produto pelo código de barras
    product = db.query(Product).filter(
        Product.codigo_barras_master == body.codigo_barras
    ).first()
    if not product:
        raise HTTPException(status_code=422, detail="Código de barras não reconhecido")

    # Localizar item da NF correspondente
    item = db.query(NFItem).filter(
        NFItem.nf_id == nf_id,
        NFItem.product_id == product.id
    ).first()
    if not item:
        raise HTTPException(status_code=422, detail="Produto não pertence a esta NF")
    if item.conferido:
        raise HTTPException(status_code=400, detail="Item já completamente conferido")

    # Registrar leitura
    item.caixas_lidas += 1
    if item.caixas_lidas >= item.caixas_necessarias:
        item.conferido = True

    # Verificar se todos os itens foram conferidos
    db.flush()
    todos_conferidos = all(i.conferido for i in nf.itens)
    if todos_conferidos:
        nf.status = "conferida"

    db.commit()
    db.refresh(nf)
    return nf


@router.post("/nf/{nf_id}/assign", response_model=NFOut)
def assign_motorista(
    nf_id: str,
    body: AssignMotoristaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor"))
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    if nf.status != "conferida":
        raise HTTPException(status_code=400, detail="NF precisa estar conferida antes de atribuir motorista")

    motorista = db.query(User).filter(
        User.id == body.motorista_id,
        User.perfil == "motorista"
    ).first()
    if not motorista:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")

    nf.motorista_id = body.motorista_id
    nf.status = "em_entrega"
    db.commit()
    db.refresh(nf)
    return nf
