from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.authorization import Permission, Role, RolePermission, UserCompanyRole
from app.models.company import Company
from app.models.user import User

router = APIRouter(prefix="/developer", tags=["developer-area"])


class CompanyCreate(BaseModel):
    legal_name: str = Field(min_length=2, max_length=180)
    trade_name: str | None = Field(default=None, max_length=180)
    cnpj: str | None = Field(default=None, pattern=r"^\d{14}$")
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    admin_name: str = Field(min_length=2, max_length=180)
    admin_email: EmailStr
    admin_password: str = Field(min_length=12, max_length=256)


class CompanyAdminCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    legal_name: str
    trade_name: str | None
    cnpj: str | None
    slug: str
    is_active: bool


class CompanyCreatedResponse(CompanyResponse):
    admin_email: EmailStr


class StatusUpdate(BaseModel):
    is_active: bool


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito à Área do Desenvolvedor.")
    return user


def _write_audit(db: Session, actor: User, action: str, resource_id: str, request: Request, details: dict) -> None:
    db.add(AuditLog(
        actor_user_id=actor.id,
        action=action,
        resource_type="company",
        resource_id=resource_id,
        ip_address=request.client.host if request.client else None,
        details=details,
    ))


def _ensure_company_admin_role(db: Session) -> Role:
    role = db.scalar(select(Role).where(Role.code == "company_admin"))
    if role is None:
        role = Role(code="company_admin", name="Administrador da transportadora",
                    description="Administrador limitado ao escopo da transportadora.", is_system=True)
        db.add(role)
        db.flush()
    permissions = (
        ("dashboard.read", "Visualizar dashboard"), ("users.manage", "Gerenciar usuários"),
        ("companies.manage", "Gerenciar dados da empresa"), ("finance.read", "Visualizar financeiro"),
        ("finance.write", "Alterar financeiro"), ("payroll.read", "Visualizar folha"),
        ("payroll.write", "Alterar folha"), ("trips.read", "Visualizar viagens"),
        ("trips.write", "Alterar viagens"), ("vehicles.read", "Visualizar veículos"),
        ("vehicles.write", "Alterar veículos"), ("expenses.read", "Visualizar despesas"),
        ("expenses.write", "Alterar despesas"),
    )
    for code, name in permissions:
        permission = db.scalar(select(Permission).where(Permission.code == code))
        if permission is None:
            permission = Permission(code=code, name=name)
            db.add(permission)
            db.flush()
        if db.scalar(select(RolePermission.id).where(
            RolePermission.role_id == role.id, RolePermission.permission_id == permission.id
        )) is None:
            db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    db.flush()
    return role


@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(_: User = Depends(require_platform_admin), db: Session = Depends(get_db)):
    return list(db.scalars(select(Company).order_by(Company.created_at.desc())).all())


@router.post("/companies", response_model=CompanyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, request: Request, actor: User = Depends(require_platform_admin),
                   db: Session = Depends(get_db)):
    email = str(payload.admin_email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Já existe um usuário com este e-mail.")
    if payload.cnpj and db.scalar(select(Company.id).where(Company.cnpj == payload.cnpj)):
        raise HTTPException(status_code=409, detail="Já existe uma transportadora com este CNPJ.")
    if db.scalar(select(Company.id).where(Company.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Este identificador já está em uso.")
    role = _ensure_company_admin_role(db)
    company = Company(legal_name=payload.legal_name.strip(), trade_name=payload.trade_name.strip() if payload.trade_name else None,
                      cnpj=payload.cnpj, slug=payload.slug, is_active=True)
    user = User(full_name=payload.admin_name.strip(), email=email, password_hash=hash_password(payload.admin_password),
                is_active=True, is_platform_admin=False)
    try:
        db.add_all([company, user])
        db.flush()
        db.add(UserCompanyRole(user_id=user.id, company_id=company.id, role_id=role.id, is_active=True))
        _write_audit(db, actor, "company.created", str(company.id), request, {"slug": company.slug, "admin_email": email})
        db.commit()
        db.refresh(company)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito de cadastro. Verifique CNPJ, identificador e e-mail.") from None
    except Exception:
        db.rollback()
        raise
    return CompanyCreatedResponse(**CompanyResponse.model_validate(company).model_dump(), admin_email=email)


@router.patch("/companies/{company_id}/status", response_model=CompanyResponse)
def update_company_status(company_id: UUID, payload: StatusUpdate, request: Request,
                          actor: User = Depends(require_platform_admin), db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Transportadora não encontrada.")
    company.is_active = payload.is_active
    _write_audit(db, actor, "company.status_changed", str(company.id), request, {"is_active": payload.is_active})
    db.commit()
    db.refresh(company)
    return company


@router.post("/companies/{company_id}/admins", status_code=status.HTTP_201_CREATED)
def create_company_admin(company_id: UUID, payload: CompanyAdminCreate, request: Request,
                         actor: User = Depends(require_platform_admin), db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Transportadora não encontrada.")
    email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Já existe um usuário com este e-mail.")
    role = _ensure_company_admin_role(db)
    user = User(full_name=payload.full_name.strip(), email=email, password_hash=hash_password(payload.password),
                is_active=True, is_platform_admin=False)
    try:
        db.add(user)
        db.flush()
        db.add(UserCompanyRole(user_id=user.id, company_id=company.id, role_id=role.id, is_active=True))
        _write_audit(db, actor, "company.admin_created", str(company.id), request, {"admin_email": email})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar administrador.") from None
    return {"message": "Administrador criado.", "company_id": str(company.id), "email": email}
