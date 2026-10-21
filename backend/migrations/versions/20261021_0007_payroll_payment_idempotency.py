"""Add idempotency reference for payroll payments.

Revision ID: 20261021_0007
Revises: 20261021_0006
Create Date: 2026-10-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261021_0007"
down_revision: Union[str, None] = "20261021_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payroll_payments", sa.Column("source_item_id", sa.String(length=80), nullable=True))
    op.create_unique_constraint(
        "uq_payroll_payments_company_source_item",
        "payroll_payments",
        ["company_id", "source_item_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_payroll_payments_company_source_item", "payroll_payments", type_="unique")
    op.drop_column("payroll_payments", "source_item_id")
