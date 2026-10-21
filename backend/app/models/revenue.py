from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Revenue(Base):
    """Receita comercial por empresa, sem confundir faturamento com recebimento."""

    __tablename__ = "revenues"
    __table_args__ = (
        UniqueConstraint("company_id", "reference", name="uq_revenues_company_reference"),
        Index("ix_revenues_company_issue_date", "company_id", "issue_date"),
        Index("ix_revenues_company_status", "company_id", "billing_status"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(40), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="frete_fracionado")
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    competency_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    transport_mode: Mapped[str | None] = mapped_column(String(60), nullable=True)
    operation_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cte_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(180), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(180), nullable=True)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    base_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    additions_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    toll_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    billing_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pendente")
    invoice_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ReceivableTitle(Base):
    """Título financeiro gerado a partir de uma receita faturada."""

    __tablename__ = "receivable_titles"
    __table_args__ = (
        Index("ix_receivable_titles_company_due_status", "company_id", "due_date", "status"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    revenue_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("revenues.id", ondelete="RESTRICT"), nullable=False, index=True)
    title_number: Mapped[str] = mapped_column(String(60), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    received_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="a_vencer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class RevenueReceipt(Base):
    """Evento de entrada financeira; não representa confirmação bancária automática."""

    __tablename__ = "revenue_receipts"
    __table_args__ = (Index("ix_revenue_receipts_company_payment_date", "company_id", "payment_date"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    transaction_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ReceiptAllocation(Base):
    """Distribuição explícita de um recebimento entre títulos."""

    __tablename__ = "revenue_receipt_allocations"
    __table_args__ = (
        UniqueConstraint("receipt_id", "title_id", name="uq_revenue_receipt_allocation"),
        Index("ix_revenue_receipt_allocations_company_title", "company_id", "title_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("revenue_receipts.id", ondelete="RESTRICT"), nullable=False)
    title_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("receivable_titles.id", ondelete="RESTRICT"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
