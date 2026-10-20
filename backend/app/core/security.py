"""Utilitários de senha. Tokens e fluxos de autenticação serão implementados em etapa própria."""

from pwdlib import PasswordHash

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Gera hash seguro; nunca armazene a senha original."""
    if not password:
        raise ValueError("A senha não pode ser vazia.")
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica uma senha contra o hash armazenado."""
    return _password_hash.verify(password, password_hash)
