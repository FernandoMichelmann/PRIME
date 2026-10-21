from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PayrollEmployeeBase(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    tax_id: str | None = Field(default=None, max_length=20)
    employment_type: str = Field(default="CLT", min_length=1, max_length=40)
    role: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=100)
    cost_center: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=180)
    address_number: str | None = Field(default=None, max_length=30)
    postal_code: str | None = Field(default=None, max_length=9)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    marital_status: str | None = Field(default=None, max_length=20)
    start_date: date
    contract_end_date: date | None = None
    salary: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    salary_split: bool = False
    salary_day5_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    salary_day20_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    integral_payment_day: str | None = Field(default=None, max_length=40)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Informe o nome completo do funcionário.")
        return value

    @field_validator("tax_id")
    @classmethod
    def normalize_tax_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = "".join(character for character in value.strip() if character.isalnum())
        return value or None


class PayrollEmployeeCreate(PayrollEmployeeBase):
    pass


class PayrollEmployeeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    tax_id: str | None = Field(default=None, max_length=20)
    employment_type: str | None = Field(default=None, min_length=1, max_length=40)
    role: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=100)
    cost_center: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=180)
    address_number: str | None = Field(default=None, max_length=30)
    postal_code: str | None = Field(default=None, max_length=9)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    marital_status: str | None = Field(default=None, max_length=20)
    start_date: date | None = None
    contract_end_date: date | None = None
    salary: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    salary_split: bool | None = None
    salary_day5_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    salary_day20_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    integral_payment_day: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Informe o nome completo do funcionário.")
        return value

    @field_validator("tax_id")
    @classmethod
    def normalize_tax_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = "".join(character for character in value.strip() if character.isalnum())
        return value or None


class PayrollEmployeeResponse(PayrollEmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
