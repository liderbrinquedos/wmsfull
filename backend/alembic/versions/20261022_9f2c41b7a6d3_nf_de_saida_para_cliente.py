"""Corrige o sentido da nota fiscal: saida para cliente, nao entrada de fornecedor.

Revision ID: 9f2c41b7a6d3
Revises: 37849d286475
Create Date: 2026-10-22 18:55:00.000000

A primeira versao do schema tratava a NF como compra de fornecedor. O WMSFull
emite a nota e entrega ao cliente, entao:

  - `destinatario` passa a ser `cliente` (o dado ja estava certo, o nome nao);
  - `fornecedor` sai (nao existe contraparte de compra neste fluxo);
  - `cnpj_fornecedor` passa a `cnpj_cliente`;
  - a unicidade deixa de ser (cnpj_fornecedor, serie, numero) e vira
    (serie, numero), porque o emitente e sempre a propria empresa.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "9f2c41b7a6d3"
down_revision: Union[str, None] = "37849d286475"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. cliente nasce do destinatario (o dado que ja existia estava certo).
    op.add_column("notas_fiscais", sa.Column("cliente", sa.String(), nullable=True))
    op.execute("UPDATE notas_fiscais SET cliente = COALESCE(destinatario, '')")
    op.alter_column("notas_fiscais", "cliente", nullable=False)
    op.drop_column("notas_fiscais", "destinatario")

    # 2. nao ha fornecedor no fluxo de saida.
    op.drop_column("notas_fiscais", "fornecedor")

    # 3. CNPJ do cliente.
    op.alter_column(
        "notas_fiscais", "cnpj_fornecedor", new_column_name="cnpj_cliente"
    )

    # 4. emitente unico: numero e sequencial por serie.
    op.drop_constraint("uq_nf_fornecedor_serie_numero", "notas_fiscais", type_="unique")
    op.create_unique_constraint(
        "uq_nf_serie_numero", "notas_fiscais", ["serie", "numero"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_nf_serie_numero", "notas_fiscais", type_="unique")
    op.create_unique_constraint(
        "uq_nf_fornecedor_serie_numero",
        "notas_fiscais",
        ["cnpj_cliente", "serie", "numero"],
    )
    op.alter_column(
        "notas_fiscais", "cnpj_cliente", new_column_name="cnpj_fornecedor"
    )

    op.add_column(
        "notas_fiscais", sa.Column("fornecedor", sa.String(), nullable=True)
    )
    op.execute("UPDATE notas_fiscais SET fornecedor = '' WHERE fornecedor IS NULL")
    op.alter_column("notas_fiscais", "fornecedor", nullable=False)

    op.add_column(
        "notas_fiscais", sa.Column("destinatario", sa.String(), nullable=True)
    )
    op.execute("UPDATE notas_fiscais SET destinatario = cliente")
    op.drop_column("notas_fiscais", "cliente")
