"""Add complete employee contact, contract and salary schedule fields.

Revision ID: 20261021_0006
Revises: 20261021_0005
Create Date: 2026-10-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261021_0006"
down_revision: Union[str, None] = "20261021_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payroll_employees", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("payroll_employees", sa.Column("address", sa.String(length=180), nullable=True))
    op.add_column("payroll_employees", sa.Column("address_number", sa.String(length=30), nullable=True))
    op.add_column("payroll_employees", sa.Column("postal_code", sa.String(length=9), nullable=True))
    op.add_column("payroll_employees", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("payroll_employees", sa.Column("state", sa.String(length=2), nullable=True))
    op.add_column("payroll_employees", sa.Column("marital_status", sa.String(length=20), nullable=True))
    op.add_column("payroll_employees", sa.Column("contract_end_date", sa.Date(), nullable=True))
    op.add_column("payroll_employees", sa.Column("salary_split", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("payroll_employees", sa.Column("salary_day5_amount", sa.Numeric(12, 2), server_default="0.00", nullable=False))
    op.add_column("payroll_employees", sa.Column("salary_day20_amount", sa.Numeric(12, 2), server_default="0.00", nullable=False))
    op.add_column("payroll_employees", sa.Column("integral_payment_day", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("payroll_employees", "integral_payment_day")
    op.drop_column("payroll_employees", "salary_day20_amount")
    op.drop_column("payroll_employees", "salary_day5_amount")
    op.drop_column("payroll_employees", "salary_split")
    op.drop_column("payroll_employees", "contract_end_date")
    op.drop_column("payroll_employees", "marital_status")
    op.drop_column("payroll_employees", "state")
    op.drop_column("payroll_employees", "city")
    op.drop_column("payroll_employees", "postal_code")
    op.drop_column("payroll_employees", "address_number")
    op.drop_column("payroll_employees", "address")
    op.drop_column("payroll_employees", "phone")
