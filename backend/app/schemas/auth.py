from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CompanyMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_id: UUID
    company_name: str
    company_slug: str
    role_code: str
    role_name: str


class AuthenticatedUserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    is_platform_admin: bool
    memberships: list[CompanyMembershipResponse]


class UserSummary(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    is_platform_admin: bool
    is_active: bool
    created_at: datetime
