import uuid
from sqlalchemy import Column, String, Boolean, Enum
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=False)
    perfil = Column(
        Enum("admin", "supervisor", "operador", "motorista", name="perfil_enum"),
        nullable=False
    )
    ativo = Column(Boolean, default=True)
