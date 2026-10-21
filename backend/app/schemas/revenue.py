from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RevenueFields(BaseModel):
    reference: str = Field(min_length=1, max_length=40)
    customer_name: str = Field(min_length=2, max_length=180)
    category: str = Field(default="frete_fracionado", min_length=1, max_length=80)
    description: str = Field(min_length=2, max_length=500)
    competency_date: date | None = None
    service_date: date | None = None
    issue_date: date | None = None
    transport_mode: str | None = Field(default=None, max_length=60)
    operation_reference: str | None = Field(default=None, max_length=100)
    cte_number: str | None = Field(default=None, max_length=80)
    origin: str | None = Field(default=None, max_length=180)
    destination: str | None = Field(default=None, max_length=180)
    weight_kg: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    base_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    additions_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    toll_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None

    @model_validator(mode="after")
    def valid_amounts(self):
        if self.discount_amount > self.base_amount + self.additions_amount + self.toll_amount:
            raise ValueError("O desconto não pode superar o total bruto da receita.")
        return self


class RevenueCreate(RevenueFields):
    pass


class RevenueUpdate(BaseModel):
    customer_name: str | None = Field(default=None, min_length=2, max_length=180)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, min_length=2, max_length=500)
    competency_date: date | None = None
    service_date: date | None = None
    transport_mode: str | None = Field(default=None, max_length=60)
    operation_reference: str | None = Field(default=None, max_length=100)
    cte_number: str | None = Field(default=None, max_length=80)
    origin: str | None = Field(default=None, max_length=180)
    destination: str | None = Field(default=None, max_length=180)
    weight_kg: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    base_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    additions_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    toll_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    discount_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    notes: str | None = None


class RevenueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    reference: str
    customer_name: str
    category: str
    description: str
    competency_date: date | None
    service_date: date | None
    issue_date: date | None
    transport_mode: str | None
    operation_reference: str | None
    cte_number: str | None
    origin: str | None
    destination: str | None
    weight_kg: Decimal | None
    base_amount: Decimal
    additions_amount: Decimal
    toll_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    billing_status: str
    invoice_number: str | None
    due_date: date | None
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class InvoiceRevenueRequest(BaseModel):
    issue_date: date
    due_date: date
    invoice_number: str = Field(min_length=1, max_length=80)
    title_number: str = Field(min_length=1, max_length=60)


class ReceivableTitleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    revenue_id: UUID
    title_number: str
    customer_name: str
    issue_date: date
    due_date: date
    original_amount: Decimal
    received_amount: Decimal
    balance: Decimal
    status: str
    created_at: datetime
    updated_at: datetime


class ReceiptAllocationInput(BaseModel):
    title_id: UUID
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class ReceiptCreate(BaseModel):
    payment_date: date
    method: str = Field(min_length=1, max_length=40)
    transaction_reference: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    allocations: list[ReceiptAllocationInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def no_duplicate_titles(self):
        ids = [item.title_id for item in self.allocations]
        if len(ids) != len(set(ids)):
            raise ValueError("Cada título deve aparecer apenas uma vez por recebimento.")
        return self


class ReceiptResponse(BaseModel):
    id: UUID
    payment_date: date
    amount: Decimal
    method: str
    transaction_reference: str | None
    notes: str | None
    created_at: datetime


class RevenueDashboardResponse(BaseModel):
    billing_total: Decimal
    received_total: Decimal
    receivable_balance: Decimal
    overdue_balance: Decimal
    pending_billing_total: Decimal
    revenues_count: int
    receivables_count: int
