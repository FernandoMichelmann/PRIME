"""Add company-scoped payroll periods and payments.

Revision ID: 20261020_0003
Revises: 20261020_0002
Create Date: 2026-10-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261020_0003"
down_revision: Union[str, None] = "20261020_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payroll_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("status", sa.String(30), server_default="preparação", nullable=False),
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "month", name="uq_payroll_periods_company_month"),
    )
    op.create_index("ix_payroll_periods_company_id", "payroll_periods", ["company_id"], unique=False)
    op.create_index("ix_payroll_periods_company_status", "payroll_periods", ["company_id", "status"], unique=False)

    op.create_table(
        "payroll_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("payment_type", sa.String(40), server_default="outro", nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pendente", nullable=False),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("method", sa.String(60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["payroll_employees.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payroll_payments_company_id", "payroll_payments", ["company_id"], unique=False)
    op.create_index("ix_payroll_payments_employee_id", "payroll_payments", ["employee_id"], unique=False)
    op.create_index("ix_payroll_payments_company_month", "payroll_payments", ["company_id", "month"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payroll_payments_company_month", table_name="payroll_payments")
    op.drop_index("ix_payroll_payments_employee_id", table_name="payroll_payments")
    op.drop_index("ix_payroll_payments_company_id", table_name="payroll_payments")
    op.drop_table("payroll_payments")
    op.drop_index("ix_payroll_periods_company_status", table_name="payroll_periods")
    op.drop_index("ix_payroll_periods_company_id", table_name="payroll_periods")
    op.drop_table("payroll_periods")
