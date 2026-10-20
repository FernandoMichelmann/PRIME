"""Criação e validação de tokens de acesso JWT."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from jwt import InvalidTokenError

from app.core.config import get_settings

ALGORITHM = "HS256"


def create_access_token(user_id: UUID, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    lifetime = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + lifetime,
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> UUID:
    """Retorna o ID do usuário ou levanta ValueError para token inválido/expirado."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("type") != "access" or not payload.get("sub"):
            raise ValueError("Token inválido.")
        return UUID(payload["sub"])
    except (InvalidTokenError, TypeError, KeyError, ValueError) as exc:
        raise ValueError("Token inválido ou expirado.") from exc
