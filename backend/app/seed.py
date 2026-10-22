"""
Seed de dados de demonstracao.

Roda depois do `alembic upgrade head` (container `migrate`) e apenas insere
dados: o schema e responsabilidade do Alembic desde a ADR-006.

So executa com SEED_DEMO_DATA=true. Em producao fica desligado, para nao criar
usuarios com senha conhecida.
"""
import sys
import os
import time
import math
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.product import Product
from app.models.nota_fiscal import NotaFiscal, NFItem
from app.models.delivery import Delivery


def wait_for_db(retries=10, delay=3):
    for i in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✅ Banco de dados conectado!")
            return True
        except Exception as e:
            print(f"⏳ Aguardando banco... tentativa {i+1}/{retries}: {e}")
            time.sleep(delay)
    raise Exception("❌ Não foi possível conectar ao banco de dados.")


def criar_admin_inicial(db) -> bool:
    """Primeiro admin em producao, sem depender do seed de demonstracao.

    Sem isso o go-live com SEED_DEMO_DATA=false fica sem nenhum usuario e
    ninguem consegue logar para criar o primeiro. So roda quando a tabela de
    usuarios esta vazia.
    """
    email = (settings.ADMIN_EMAIL or "").strip()
    senha = settings.ADMIN_SENHA or ""
    if not email or not senha:
        return False
    if db.query(User).count() > 0:
        print("ℹ️  Ja existem usuarios: admin inicial nao e criado.")
        return False
    if len(senha) < 8:
        raise SystemExit("ADMIN_SENHA precisa ter ao menos 8 caracteres")

    db.add(
        User(
            nome="Administrador",
            email=email,
            senha_hash=get_password_hash(senha),
            perfil="admin",
            ativo=True,
        )
    )
    db.commit()
    print(f"✅ Usuario admin inicial criado: {email}")
    return True


def seed():
    # Dados de demonstracao so entram com SEED_DEMO_DATA=true. Em producao o
    # default e false: sem essa trava o container criaria usuarios com senha
    # conhecida (admin123) em todo boot.
    if not settings.SEED_DEMO_DATA:
        if settings.ADMIN_EMAIL and settings.ADMIN_SENHA:
            wait_for_db()
            db = SessionLocal()
            try:
                criar_admin_inicial(db)
            finally:
                db.close()
        else:
            print(
                "⏭️  Seed desativado "
                "(SEED_DEMO_DATA=false e sem ADMIN_EMAIL/ADMIN_SENHA)."
            )
        return

    wait_for_db()

    db = SessionLocal()
    try:
        # Verificar se já foi seedado
        if db.query(User).count() > 0:
            print("ℹ️  Seed já executado anteriormente. Pulando...")
            return

        # ── Usuários ─────────────────────────────────────────────
        users = [
            User(id="u1", nome="Admin Master",    email="admin@log.com",     senha_hash=get_password_hash("admin123"),  perfil="admin"),
            User(id="u2", nome="Ana Supervisora", email="super@log.com",     senha_hash=get_password_hash("super123"),  perfil="supervisor"),
            User(id="u3", nome="Carlos Operador", email="operador@log.com",  senha_hash=get_password_hash("op123"),     perfil="operador"),
            User(id="u4", nome="João Silva",      email="joao@log.com",      senha_hash=get_password_hash("moto123"),   perfil="motorista"),
            User(id="u5", nome="Pedro Souza",     email="pedro@log.com",     senha_hash=get_password_hash("moto456"),   perfil="motorista"),
        ]
        db.add_all(users)
        db.flush()
        print("✅ Usuários criados!")

        # ── Produtos ─────────────────────────────────────────────
        # EAN13 = unidade; EAN14 = caixa master (DUN14). Valores com digito
        # verificador correto, para o demo exercitar a mesma validacao do import.
        products = [
            Product(id="p1", codigo="21", referencia="49", descricao="Caixa Produto A", qtd_embalagem=6,  localizacao="F102C", estoque_caixas=20, ean13="7891234560018", ean14="17891234560015", ean13_origem="erp", ean14_origem="ficha"),
            Product(id="p2", codigo="22", referencia="50", descricao="Caixa Produto B", qtd_embalagem=12, localizacao="A203B", estoque_caixas=15, ean13="7891234560025", ean14="17891234560022", ean13_origem="erp", ean14_origem="ficha"),
            Product(id="p3", codigo="23", referencia="51", descricao="Caixa Produto C", qtd_embalagem=4,  localizacao="B101A", estoque_caixas=30, ean13="7891234560032", ean14="17891234560039", ean13_origem="erp", ean14_origem="ficha"),
            Product(id="p4", codigo="24", referencia="52", descricao="Caixa Produto D", qtd_embalagem=24, localizacao="C305D", estoque_caixas=8,  ean13="7891234560049", ean14="17891234560046", ean13_origem="erp", ean14_origem="ficha"),
            Product(id="p5", codigo="25", referencia="53", descricao="Caixa Produto E", qtd_embalagem=8,  localizacao="D204A", estoque_caixas=12, ean13="7891234560056", ean14="17891234560053", ean13_origem="erp", ean14_origem="ficha"),
        ]
        db.add_all(products)
        db.flush()
        print("✅ Produtos criados!")

        # ── Notas Fiscais (saida para clientes) ───────────────────
        def make_nf(nf_id, numero, cliente, cnpj_cliente, endereco, motorista_id, itens_data, seq):
            # Chave de acesso da NF-e (44 digitos): cUF + AAMM + CNPJ + modelo +
            # serie + numero + tpEmis + codigo + DV. Valor de demonstracao.
            chave = f"3524061234567800019955001{seq:09d}1123456780"
            nf = NotaFiscal(
                id=nf_id, numero=numero, serie="1", chave_nfe=chave,
                cliente=cliente, cnpj_cliente=cnpj_cliente, endereco=endereco,
                data_emissao=date(2024, 6, seq),
                status="pendente", motorista_id=motorista_id
            )
            db.add(nf)
            db.flush()
            for item_id, product_id, qtd_nota, qtd_emb in itens_data:
                db.add(NFItem(
                    id=item_id, nf_id=nf_id, product_id=product_id,
                    qtd_nota=qtd_nota, qtd_embalagem=qtd_emb,
                    caixas_necessarias=math.ceil(qtd_nota / qtd_emb),
                    caixas_lidas=0, conferido=False
                ))

        make_nf("nf1", "NF-2024-001", "Cliente Alpha LTDA", "11222333000181", "Rua das Flores, 123 - São Paulo/SP", "u4", [
            ("i1", "p1", 12, 6),   # 12 ÷ 6 = 2 caixas
            ("i2", "p2", 24, 12),  # 24 ÷ 12 = 2 caixas
        ], 1)
        make_nf("nf2", "NF-2024-002", "Cliente Beta ME", "22333444000172", "Av. Paulista, 456 - São Paulo/SP", "u5", [
            ("i3", "p3", 8,  4),   # 8 ÷ 4 = 2 caixas
            ("i4", "p4", 48, 24),  # 48 ÷ 24 = 2 caixas
        ], 2)
        make_nf("nf3", "NF-2024-003", "Cliente Gamma SA", "33444555000163", "Rua XV de Novembro, 789 - Curitiba/PR", "u4", [
            ("i5", "p5", 16, 8),   # 16 ÷ 8 = 2 caixas
            ("i6", "p1", 6,  6),   # 6 ÷ 6 = 1 caixa
        ], 3)

        db.commit()
        print("✅ Notas Fiscais criadas!")
        print("🎉 Seed concluído com sucesso!")
        print("\n📋 Usuários de acesso:")
        print("   admin@log.com    / admin123   → Administrador")
        print("   super@log.com    / super123   → Supervisor")
        print("   operador@log.com / op123      → Operador")
        print("   joao@log.com     / moto123    → Motorista João")
        print("   pedro@log.com    / moto456    → Motorista Pedro")

    except Exception as e:
        db.rollback()
        print(f"❌ Erro no seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
