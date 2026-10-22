from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.nota_fiscal import NotaFiscal
from app.models.delivery import Delivery
from app.schemas.schemas import UserOut, UserCreate, UserUpdate
from app.core.security import get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    return db.query(User).order_by(User.nome).all()


@router.post("/users", response_model=UserOut)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    if body.perfil not in ("admin", "supervisor", "operador", "motorista"):
        raise HTTPException(status_code=400, detail="Perfil inválido")

    user = User(
        nome=body.nome,
        email=body.email,
        senha_hash=get_password_hash(body.senha),
        perfil=body.perfil,
        ativo=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin"))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if body.nome is not None:
        user.nome = body.nome
    if body.email is not None:
        user.email = body.email
    if body.perfil is not None:
        user.perfil = body.perfil
    if body.ativo is not None:
        user.ativo = body.ativo
    db.commit()
    db.refresh(user)
    return user


@router.get("/motoristas", response_model=list[UserOut])
def list_motoristas(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor"))
):
    return db.query(User).filter(User.perfil == "motorista", User.ativo == True).all()


@router.get("/reports/deliveries")
def delivery_report(
    motorista_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor"))
):
    query = db.query(Delivery)
    if motorista_id:
        query = query.filter(Delivery.motorista_id == motorista_id)
    deliveries = query.order_by(Delivery.created_at.desc()).all()

    return [
        {
            "id": d.id,
            "nf_numero": d.nota_fiscal.numero if d.nota_fiscal else None,
            "motorista": d.motorista.nome if d.motorista else None,
            "status": d.status,
            "motivo_falha": d.motivo_falha,
            "data_reagendamento": str(d.data_reagendamento) if d.data_reagendamento else None,
            "foto_canhoto_url": d.foto_canhoto_url,
            "created_at": str(d.created_at)
        }
        for d in deliveries
    ]


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor"))
):
    nfs = db.query(NotaFiscal).all()
    by_status = {}
    for nf in nfs:
        by_status[nf.status] = by_status.get(nf.status, 0) + 1

    return {
        "total_nfs": len(nfs),
        "by_status": by_status,
        "total_usuarios": db.query(User).count(),
        "motoristas_ativos": db.query(User).filter(User.perfil == "motorista", User.ativo == True).count()
    }
