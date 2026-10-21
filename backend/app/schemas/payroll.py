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
    start_date: date
    salary: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
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
    start_date: date | None = None
    salary: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
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
