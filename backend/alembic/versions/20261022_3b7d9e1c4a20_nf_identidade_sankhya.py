"""Identidade da NF: empresa + fila do Sankhya (NUNOTA) e empresa/serie/numero.

Revision ID: 3b7d9e1c4a20
Revises: 9f2c41b7a6d3
Create Date: 2026-10-22 19:25:00.000000

O ERP e o Sankhya, e a mesma base atende mais de uma empresa. A nota tem duas
identidades:

  - NUNOTA  -> numero unico do sistema, o que evita duplicidade no sync;
  - NUMNOTA -> numero da nota na SEFAZ, unico por (CODEMP, SERIENOTA).

A unicidade passa de (serie, numero) para (codigo_empresa, serie, numero).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3b7d9e1c4a20"
down_revision: Union[str, None] = "9f2c41b7a6d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Empresas existentes (dados de demonstracao) passam a ser a empresa 1.
    op.add_column(
        "notas_fiscais", sa.Column("codigo_empresa", sa.Integer(), nullable=True)
    )
    op.execute("UPDATE notas_fiscais SET codigo_empresa = 1")
    op.alter_column("notas_fiscais", "codigo_empresa", nullable=False)

    op.add_column("notas_fiscais", sa.Column("nunota", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_nf_nunota", "notas_fiscais", ["nunota"])

    op.drop_constraint("uq_nf_serie_numero", "notas_fiscais", type_="unique")
    op.create_unique_constraint(
        "uq_nf_empresa_serie_numero",
        "notas_fiscais",
        ["codigo_empresa", "serie", "numero"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_nf_empresa_serie_numero", "notas_fiscais", type_="unique")
    op.create_unique_constraint(
        "uq_nf_serie_numero", "notas_fiscais", ["serie", "numero"]
    )
    op.drop_constraint("uq_nf_nunota", "notas_fiscais", type_="unique")
    op.drop_column("notas_fiscais", "nunota")
    op.drop_column("notas_fiscais", "codigo_empresa")
