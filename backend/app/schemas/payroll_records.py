import re
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PayrollPeriodItem(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    employee_id: UUID
    description: str = Field(min_length=1, max_length=120)
    kind: str = Field(min_length=1, max_length=40)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    created_at: datetime | None = None


class PayrollPeriodCreate(BaseModel):
    month: str
    status: str = "preparação"
    items: list[PayrollPeriodItem] = Field(default_factory=list)
    approved_at: datetime | None = None

    @field_validator("month")
    @classmethod
    def valid_month(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
            raise ValueError("Competência deve estar no formato AAAA-MM.")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"preparação", "aprovada", "parcial", "paga", "fechada"}:
            raise ValueError("Status de competência inválido.")
        return value


class PayrollPeriodUpdate(BaseModel):
    status: str | None = None
    items: list[PayrollPeriodItem] | None = None
    approved_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"preparação", "aprovada", "parcial", "paga", "fechada"}:
            raise ValueError("Status de competência inválido.")
        return value


class PayrollPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    month: str
    status: str
    items: list[dict]
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PayrollPaymentCreate(BaseModel):
    employee_id: UUID
    month: str
    payment_type: str = Field(default="outro", min_length=1, max_length=40)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: date
    status: str = "pendente"
    paid_at: date | None = None
    method: str | None = Field(default=None, max_length=60)

    @field_validator("month")
    @classmethod
    def valid_month(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
            raise ValueError("Competência deve estar no formato AAAA-MM.")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in {"pendente", "pago"}:
            raise ValueError("Status de pagamento inválido.")
        return value

    @field_validator("paid_at")
    @classmethod
    def paid_date_required(cls, value: date | None, info):
        if info.data.get("status") == "pago" and value is None:
            raise ValueError("Informe a data efetiva do pagamento.")
        return value


class PayrollPaymentUpdate(BaseModel):
    month: str | None = None
    payment_type: str | None = Field(default=None, min_length=1, max_length=40)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    due_date: date | None = None
    status: str | None = None
    paid_at: date | None = None
    method: str | None = Field(default=None, max_length=60)

    @field_validator("month")
    @classmethod
    def valid_month(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"\\d{4}-(0[1-9]|1[0-2])", value):
            raise ValueError("Competência deve estar no formato AAAA-MM.")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"pendente", "pago"}:
            raise ValueError("Status de pagamento inválido.")
        return value


class PayrollPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    employee_id: UUID
    month: str
    payment_type: str
    amount: Decimal
    due_date: date
    status: str
    paid_at: date | None
    method: str | None
    created_at: datetime
    updated_at: datetime
