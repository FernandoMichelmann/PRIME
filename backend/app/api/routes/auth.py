from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import verify_password
from app.core.tokens import create_access_token
from app.db.session import get_db
from app.models.authorization import UserCompanyRole
from app.models.company import Company
from app.models.user import User
from app.schemas.auth import (
    AuthenticatedUserResponse,
    CompanyMembershipResponse,
    LoginRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


def _memberships_for_user(db: Session, user_id) -> list[CompanyMembershipResponse]:
    statement = (
        select(UserCompanyRole, Company)
        .join(Company, Company.id == UserCompanyRole.company_id)
        .where(
            UserCompanyRole.user_id == user_id,
            UserCompanyRole.is_active.is_(True),
            Company.is_active.is_(True),
        )
        .order_by(Company.trade_name, Company.legal_name)
    )
    results = db.execute(statement).all()
    memberships: list[CompanyMembershipResponse] = []
    for membership, company in results:
        if membership.role is None:
            continue
        memberships.append(
            CompanyMembershipResponse(
                company_id=company.id,
                company_name=company.trade_name or company.legal_name,
                company_slug=company.slug,
                role_code=membership.role.code,
                role_name=membership.role.name,
            )
        )
    return memberships


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    normalized_email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        # Mensagem idêntica para usuário inexistente, senha incorreta ou conta desativada.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_platform_admin=user.is_platform_admin,
        memberships=_memberships_for_user(db, user.id),
    )


@router.get("/companies", response_model=list[CompanyMembershipResponse])
def list_my_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CompanyMembershipResponse]:
    """Lista somente empresas ativas às quais o usuário tem vínculo ativo."""
    return _memberships_for_user(db, user.id)
