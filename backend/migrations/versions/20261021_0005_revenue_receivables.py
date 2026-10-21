"""Create company-scoped revenue and receivables tables.

Revision ID: 20261021_0005
Revises: 20261020_0004
Create Date: 2026-10-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261021_0005"
down_revision: Union[str, None] = "20261020_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "revenues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(40), nullable=False),
        sa.Column("customer_name", sa.String(180), nullable=False),
        sa.Column("category", sa.String(80), server_default="frete_fracionado", nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("competency_date", sa.Date(), nullable=True),
        sa.Column("service_date", sa.Date(), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("transport_mode", sa.String(60), nullable=True),
        sa.Column("operation_reference", sa.String(100), nullable=True),
        sa.Column("cte_number", sa.String(80), nullable=True),
        sa.Column("origin", sa.String(180), nullable=True),
        sa.Column("destination", sa.String(180), nullable=True),
        sa.Column("weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("base_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("additions_amount", sa.Numeric(14, 2), server_default="0.00", nullable=False),
        sa.Column("toll_amount", sa.Numeric(14, 2), server_default="0.00", nullable=False),
        sa.Column("discount_amount", sa.Numeric(14, 2), server_default="0.00", nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("billing_status", sa.String(30), server_default="pendente", nullable=False),
        sa.Column("invoice_number", sa.String(80), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "reference", name="uq_revenues_company_reference"),
    )
    op.create_index("ix_revenues_company_id", "revenues", ["company_id"], unique=False)
    op.create_index("ix_revenues_company_issue_date", "revenues", ["company_id", "issue_date"], unique=False)
    op.create_index("ix_revenues_company_status", "revenues", ["company_id", "billing_status"], unique=False)

    op.create_table(
        "receivable_titles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revenue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title_number", sa.String(60), nullable=False),
        sa.Column("customer_name", sa.String(180), nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("original_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("received_amount", sa.Numeric(14, 2), server_default="0.00", nullable=False),
        sa.Column("status", sa.String(30), server_default="a_vencer", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["revenue_id"], ["revenues.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "title_number", name="uq_receivable_titles_company_number"),
    )
    op.create_index("ix_receivable_titles_company_id", "receivable_titles", ["company_id"], unique=False)
    op.create_index("ix_receivable_titles_revenue_id", "receivable_titles", ["revenue_id"], unique=False)
    op.create_index("ix_receivable_titles_company_due_status", "receivable_titles", ["company_id", "due_date", "status"], unique=False)

    op.create_table(
        "revenue_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("method", sa.String(40), nullable=False),
        sa.Column("transaction_reference", sa.String(120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "transaction_reference", name="uq_revenue_receipts_company_transaction"),
    )
    op.create_index("ix_revenue_receipts_company_id", "revenue_receipts", ["company_id"], unique=False)
    op.create_index("ix_revenue_receipts_company_payment_date", "revenue_receipts", ["company_id", "payment_date"], unique=False)

    op.create_table(
        "revenue_receipt_allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receipt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["receipt_id"], ["revenue_receipts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["title_id"], ["receivable_titles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("receipt_id", "title_id", name="uq_revenue_receipt_allocation"),
    )
    op.create_index("ix_revenue_receipt_allocations_company_id", "revenue_receipt_allocations", ["company_id"], unique=False)
    op.create_index("ix_revenue_receipt_allocations_company_title", "revenue_receipt_allocations", ["company_id", "title_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_revenue_receipt_allocations_company_title", table_name="revenue_receipt_allocations")
    op.drop_index("ix_revenue_receipt_allocations_company_id", table_name="revenue_receipt_allocations")
    op.drop_table("revenue_receipt_allocations")
    op.drop_index("ix_revenue_receipts_company_payment_date", table_name="revenue_receipts")
    op.drop_index("ix_revenue_receipts_company_id", table_name="revenue_receipts")
    op.drop_table("revenue_receipts")
    op.drop_index("ix_receivable_titles_company_due_status", table_name="receivable_titles")
    op.drop_index("ix_receivable_titles_revenue_id", table_name="receivable_titles")
    op.drop_index("ix_receivable_titles_company_id", table_name="receivable_titles")
    op.drop_table("receivable_titles")
    op.drop_index("ix_revenues_company_status", table_name="revenues")
    op.drop_index("ix_revenues_company_issue_date", table_name="revenues")
    op.drop_index("ix_revenues_company_id", table_name="revenues")
    op.drop_table("revenues")
