import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.core.config import settings
from app.models.nota_fiscal import NotaFiscal
from app.models.delivery import Delivery
from app.models.user import User
from app.schemas.schemas import NFOut, DeliveryOut, RescheduleRequest
from datetime import date

router = APIRouter(prefix="/delivery", tags=["Entrega"])


@router.get("/nf", response_model=list[NFOut])
def list_my_nfs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(NotaFiscal).filter(
        NotaFiscal.status.in_(["em_entrega", "entregue", "reagendado"])
    )
    # Motorista só vê suas próprias NFs
    if current_user.perfil == "motorista":
        query = query.filter(NotaFiscal.motorista_id == current_user.id)
    return query.order_by(NotaFiscal.created_at.desc()).all()


@router.post("/nf/{nf_id}/deliver", response_model=DeliveryOut)
async def confirm_delivery(
    nf_id: str,
    foto: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    if nf.status != "em_entrega":
        raise HTTPException(status_code=400, detail="NF não está em entrega")
    if current_user.perfil == "motorista" and nf.motorista_id != current_user.id:
        raise HTTPException(status_code=403, detail="NF não atribuída a você")

    foto_url = None
    if foto and foto.filename:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(foto.filename)[1] or ".jpg"
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)
        content = await foto.read()
        with open(filepath, "wb") as f:
            f.write(content)
        foto_url = f"/uploads/{filename}"

    delivery = Delivery(
        nf_id=nf_id,
        motorista_id=current_user.id,
        status="entregue",
        foto_canhoto_url=foto_url
    )
    db.add(delivery)
    nf.status = "entregue"
    db.commit()
    db.refresh(delivery)
    return delivery


@router.post("/nf/{nf_id}/reschedule", response_model=DeliveryOut)
def reschedule_delivery(
    nf_id: str,
    body: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    nf = db.query(NotaFiscal).filter(NotaFiscal.id == nf_id).first()
    if not nf:
        raise HTTPException(status_code=404, detail="NF não encontrada")
    if nf.status != "em_entrega":
        raise HTTPException(status_code=400, detail="NF não está em entrega")
    if current_user.perfil == "motorista" and nf.motorista_id != current_user.id:
        raise HTTPException(status_code=403, detail="NF não atribuída a você")

    delivery = Delivery(
        nf_id=nf_id,
        motorista_id=current_user.id,
        status="reagendado",
        motivo_falha=body.motivo,
        data_reagendamento=body.data_reagendamento
    )
    db.add(delivery)
    nf.status = "reagendado"
    db.commit()
    db.refresh(delivery)
    return delivery
