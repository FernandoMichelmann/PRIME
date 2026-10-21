from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_company_permission
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.authorization import Permission, Role, RolePermission, UserCompanyRole
from app.models.user import User

router = APIRouter(prefix="/users", tags=["company-users"])


def normalize_cpf(value: str) -> str:
    value = "".join(c for c in value if c.isdigit())
    if len(value) != 11 or len(set(value)) == 1:
        raise ValueError("CPF inválido.")
    for length in (9, 10):
        total = sum(int(value[i]) * (length + 1 - i) for i in range(length))
        digit = (total * 10) % 11
        if (0 if digit == 10 else digit) != int(value[length]):
            raise ValueError("CPF inválido.")
    return value


class UserFields(BaseModel):
    full_name: str = Field(min_length=3, max_length=180)
    birth_date: date
    cpf: str = Field(min_length=11, max_length=14)
    rg: str = Field(min_length=2, max_length=30)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=30)

    @field_validator("cpf")
    @classmethod
    def cpf_valid(cls, v: str) -> str:
        return normalize_cpf(v)

    @field_validator("email")
    @classmethod
    def email_normalized(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("full_name", "rg", "phone")
    @classmethod
    def trim(cls, v: str) -> str:
        return v.strip()


class UserCreate(UserFields):
    password: str = Field(min_length=12, max_length=256)


class UserStatus(BaseModel):
    is_active: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    birth_date: date | None
    cpf: str | None
    rg: str | None
    email: EmailStr
    phone: str | None
    is_active: bool
    role_name: str


def basic_role(db: Session) -> Role:
    role = db.scalar(select(Role).where(Role.code == "company_user"))
    if role:
        return role
    role = Role(code="company_user", name="Usuário da empresa",
                description="Acesso básico de consulta", is_system=True)
    db.add(role)
    db.flush()
    for code in ("dashboard.read", "finance.read", "payroll.read", "trips.read",
                 "vehicles.read", "expenses.read"):
        perm = db.scalar(select(Permission).where(Permission.code == code))
        if perm is None:
            perm = Permission(code=code, name=code.replace(".", " ").title())
            db.add(perm)
            db.flush()
        db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    db.flush()
    return role


def response(user: User, link: UserCompanyRole) -> UserResponse:
    return UserResponse(id=user.id, full_name=user.full_name, birth_date=user.birth_date,
        cpf=user.cpf, rg=user.rg, email=user.email, phone=user.phone,
        is_active=user.is_active, role_name=link.role.name if link.role else "Usuário")


def audit(db: Session, actor: User, company_id: UUID, action: str, user: User,
          request: Request, details: dict) -> None:
    db.add(AuditLog(company_id=company_id, actor_user_id=actor.id, action=action,
        resource_type="user", resource_id=str(user.id),
        ip_address=request.client.host if request.client else None, details=details))


@router.get("", response_model=list[UserResponse])
def list_users(link: UserCompanyRole = Depends(require_company_permission("users.manage")),
               db: Session = Depends(get_db)):
    rows = db.execute(select(User, UserCompanyRole)
        .join(UserCompanyRole, UserCompanyRole.user_id == User.id)
        .where(UserCompanyRole.company_id == link.company_id,
               UserCompanyRole.is_active.is_(True)).order_by(User.full_name)).all()
    return [response(user, membership) for user, membership in rows if membership.role]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, request: Request,
                link: UserCompanyRole = Depends(require_company_permission("users.manage")),
                db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.")
    if db.scalar(select(User.id).where(User.cpf == payload.cpf)):
        raise HTTPException(status_code=409, detail="Já existe uma conta com este CPF.")
    actor = db.get(User, link.user_id)
    role = basic_role(db)
    user = User(full_name=payload.full_name.strip(), birth_date=payload.birth_date,
        cpf=payload.cpf, rg=payload.rg.strip(), email=email, phone=payload.phone.strip(),
        password_hash=hash_password(payload.password), is_active=True, is_platform_admin=False)
    try:
        db.add(user)
        db.flush()
        membership = UserCompanyRole(user_id=user.id, company_id=link.company_id,
                                     role_id=role.id, is_active=True)
        db.add(membership)
        audit(db, actor, link.company_id, "user.created", user, request,
              {"email": email, "role": role.code})
        db.commit()
        db.refresh(user)
        db.refresh(membership)
        return response(user, membership)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito: e-mail ou CPF já cadastrado.") from None


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: UUID, payload: UserFields, request: Request,
                link: UserCompanyRole = Depends(require_company_permission("users.manage")),
                db: Session = Depends(get_db)):
    membership = db.scalar(select(UserCompanyRole).where(
        UserCompanyRole.user_id == user_id, UserCompanyRole.company_id == link.company_id,
        UserCompanyRole.is_active.is_(True)))
    user = db.get(User, user_id) if membership else None
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado nesta empresa.")
    email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email, User.id != user.id)):
        raise HTTPException(status_code=409, detail="Este e-mail já está em uso.")
    if db.scalar(select(User.id).where(User.cpf == payload.cpf, User.id != user.id)):
        raise HTTPException(status_code=409, detail="Este CPF já está em uso.")
    user.full_name, user.birth_date = payload.full_name.strip(), payload.birth_date
    user.cpf, user.rg, user.email, user.phone = payload.cpf, payload.rg.strip(), email, payload.phone.strip()
    actor = db.get(User, link.user_id)
    audit(db, actor, link.company_id, "user.updated", user, request, {"email": email})
    try:
        db.commit()
        db.refresh(user)
        return response(user, membership)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao atualizar cadastro.") from None


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_status(user_id: UUID, payload: UserStatus, request: Request,
                  link: UserCompanyRole = Depends(require_company_permission("users.manage")),
                  db: Session = Depends(get_db)):
    membership = db.scalar(select(UserCompanyRole).where(
        UserCompanyRole.user_id == user_id, UserCompanyRole.company_id == link.company_id,
        UserCompanyRole.is_active.is_(True)))
    user = db.get(User, user_id) if membership else None
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado nesta empresa.")
    if user.id == link.user_id and not payload.is_active:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta.")
    actor = db.get(User, link.user_id)
    user.is_active = payload.is_active
    membership.is_active = payload.is_active
    audit(db, actor, link.company_id, "user.status_changed", user, request,
          {"is_active": payload.is_active})
    db.commit()
    db.refresh(user)
    db.refresh(membership)
    return response(user, membership)
