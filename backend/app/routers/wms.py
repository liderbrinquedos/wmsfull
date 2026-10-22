from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.product import Product
from app.models.user import User
from app.schemas.schemas import ProductOut, ProductUpdate

router = APIRouter(prefix="/wms", tags=["WMS"])


@router.get("/products", response_model=list[ProductOut])
def list_products(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            Product.codigo.ilike(search_term) |
            Product.referencia.ilike(search_term) |
            Product.descricao.ilike(search_term)
        )
    return query.order_by(Product.localizacao).all()


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return product


@router.put("/products/{product_id}/location", response_model=ProductOut)
def update_location(
    product_id: str,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor"))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if body.localizacao is not None:
        product.localizacao = body.localizacao
    if body.estoque_caixas is not None:
        product.estoque_caixas = body.estoque_caixas
    db.commit()
    db.refresh(product)
    return product


@router.get("/stats")
def wms_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    products = db.query(Product).all()
    ruas = {}
    for p in products:
        rua = p.localizacao[0] if p.localizacao else "?"
        ruas[rua] = ruas.get(rua, 0) + 1

    return {
        "total_produtos": len(products),
        "total_caixas": sum(p.estoque_caixas for p in products),
        "estoque_baixo": [p.id for p in products if p.estoque_caixas < 5],
        "por_rua": ruas
    }
