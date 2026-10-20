from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.authorization import Permission, RolePermission, UserCompanyRole
from app.models.company import Company
from app.models.user import User
from app.core.tokens import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais ausentes, inválidas ou expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise unauthorized from None

    user = db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        raise unauthorized
    return user


def require_company_permission(permission_code: str) -> Callable:
    """Valida vínculo ativo, empresa ativa e permissão no escopo da empresa."""

    def dependency(
        company_id: UUID = Header(alias="X-Company-ID"),
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> UserCompanyRole:
        statement = (
            select(UserCompanyRole)
            .join(Company, Company.id == UserCompanyRole.company_id)
            .join(RolePermission, RolePermission.role_id == UserCompanyRole.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                UserCompanyRole.user_id == user.id,
                UserCompanyRole.company_id == company_id,
                UserCompanyRole.is_active.is_(True),
                Company.is_active.is_(True),
                Permission.code == permission_code,
            )
        )
        membership = db.scalar(statement)
        if membership is None:
            # Resposta genérica para não revelar se a empresa ou a permissão existe.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado para esta empresa ou operação.",
            )
        return membership

    return dependency
