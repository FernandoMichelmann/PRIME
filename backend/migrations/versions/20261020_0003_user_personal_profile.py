"""Add personal profile fields to PRIME users.

Revision ID: 20261020_0003
Revises: 20261020_0002
Create Date: 2026-10-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20261020_0003"
down_revision: Union[str, None] = "20261020_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("cpf", sa.String(length=11), nullable=True))
    op.add_column("users", sa.Column("rg", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.create_unique_constraint("uq_users_cpf", "users", ["cpf"])

def downgrade() -> None:
    op.drop_constraint("uq_users_cpf", "users", type_="unique")
    op.drop_column("users", "phone")
    op.drop_column("users", "rg")
    op.drop_column("users", "cpf")
    op.drop_column("users", "birth_date")
