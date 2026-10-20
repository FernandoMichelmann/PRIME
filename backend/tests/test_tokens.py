from datetime import timedelta
from uuid import uuid4

import pytest

from app.core.tokens import create_access_token, decode_access_token


def test_access_token_round_trip() -> None:
    user_id = uuid4()
    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token(uuid4(), expires_delta=timedelta(seconds=-1))

    with pytest.raises(ValueError, match="Token inválido ou expirado"):
        decode_access_token(token)


def test_malformed_access_token_is_rejected() -> None:
    with pytest.raises(ValueError, match="Token inválido ou expirado"):
        decode_access_token("not.a.valid.token")
