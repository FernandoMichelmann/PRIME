import pytest

from app.core.security import hash_password, verify_password


def test_password_hash_is_not_plain_text_and_can_be_verified() -> None:
    password = "Senha-forte-de-teste-2026!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("senha-incorreta", hashed) is False


def test_empty_password_is_rejected() -> None:
    with pytest.raises(ValueError):
        hash_password("")
