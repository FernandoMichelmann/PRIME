"""Add company-scoped payroll employee records.

Revision ID: 20261020_0002
Revises: 20261020_0001
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0002"
down_revision: Union[str, None] = "20261020_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payroll_employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("tax_id", sa.String(length=20), nullable=True),
        sa.Column("employment_type", sa.String(length=40), server_default="CLT", nullable=False),
        sa.Column("role", sa.String(length=120), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("cost_center", sa.String(length=100), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("salary", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "tax_id", name="uq_payroll_employees_company_tax_id"),
    )
    op.create_index("ix_payroll_employees_company_id", "payroll_employees", ["company_id"], unique=False)
    op.create_index(
        "ix_payroll_employees_company_status",
        "payroll_employees",
        ["company_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_payroll_employees_company_status", table_name="payroll_employees")
    op.drop_index("ix_payroll_employees_company_id", table_name="payroll_employees")
    op.drop_table("payroll_employees")
