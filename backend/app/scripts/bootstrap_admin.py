"""Provisiona a primeira transportadora e seu administrador de forma controlada.

Execute somente após aplicar as migrações, no ambiente local ou em uma sessão
administrativa segura. Não cria uma rota pública de cadastro.
"""
from __future__ import annotations

import re
import sys
from getpass import getpass

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.authorization import Permission, Role, RolePermission, UserCompanyRole
from app.models.company import Company
from app.models.user import User


ADMIN_ROLE_CODE = "company_admin"
ADMIN_ROLE_NAME = "Administrador da transportadora"

# Permissões iniciais. Podem ser ampliadas conforme os módulos reais forem conectados.
INITIAL_PERMISSIONS = (
    ("dashboard.read", "Visualizar dashboard"),
    ("users.manage", "Gerenciar usuários"),
    ("companies.manage", "Gerenciar dados da empresa"),
    ("finance.read", "Visualizar financeiro"),
    ("finance.write", "Alterar financeiro"),
    ("payroll.read", "Visualizar folha"),
    ("payroll.write", "Alterar folha"),
    ("trips.read", "Visualizar viagens"),
    ("trips.write", "Alterar viagens"),
    ("vehicles.read", "Visualizar veículos"),
    ("vehicles.write", "Alterar veículos"),
    ("expenses.read", "Visualizar despesas"),
    ("expenses.write", "Alterar despesas"),
)


def ask_required(prompt: str, *, maximum: int = 180) -> str:
    while True:
        value = input(prompt).strip()
        if value and len(value) <= maximum:
            return value
        print(f"Informe um valor entre 1 e {maximum} caracteres.")


def ask_slug() -> str:
    while True:
        value = input("Identificador da transportadora (ex.: minha-transportadora): ").strip().lower()
        if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value) and len(value) <= 80:
            return value
        print("Use letras minúsculas, números e hífens, sem hífen no início/fim.")


def ask_email() -> str:
    while True:
        value = input("E-mail do administrador: ").strip().lower()
        if len(value) <= 254 and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            return value
        print("Informe um e-mail válido.")


def ask_password() -> str:
    while True:
        password = getpass("Senha inicial (mínimo 12 caracteres): ")
        if len(password) < 12:
            print("A senha precisa ter pelo menos 12 caracteres.")
            continue
        confirmation = getpass("Confirme a senha: ")
        if password != confirmation:
            print("As senhas não coincidem.")
            continue
        return password


def main() -> int:
    print("\nPRIME — Provisionamento inicial seguro")
    print("Este procedimento só funciona se ainda não houver usuários cadastrados.\n")

    with SessionLocal() as db:
        existing_users = db.scalar(select(func.count()).select_from(User)) or 0
        if existing_users:
            print("ABORTADO: já existe pelo menos um usuário. Este script é exclusivo para o bootstrap inicial.")
            return 1

    legal_name = ask_required("Razão social da transportadora: ")
    trade_name = input("Nome fantasia (opcional): ").strip() or None
    slug = ask_slug()
    cnpj = input("CNPJ somente números (opcional): ").strip() or None
    if cnpj and not re.fullmatch(r"\d{14}", cnpj):
        print("CNPJ deve conter exatamente 14 números, ou deixe em branco.")
        return 1
    full_name = ask_required("Nome completo do administrador: ")
    email = ask_email()
    password = ask_password()

    print("\nConfirme os dados:")
    print(f"Empresa: {legal_name}")
    print(f"Nome fantasia: {trade_name or '(não informado)'}")
    print(f"Identificador: {slug}")
    print(f"Administrador: {full_name} <{email}>")
    confirmation = input("Criar a empresa e o administrador? Digite CRIAR para confirmar: ").strip()
    if confirmation != "CRIAR":
        print("Operação cancelada; nenhum registro foi criado.")
        return 1

    try:
        with SessionLocal.begin() as db:
            if db.scalar(select(func.count()).select_from(User)):
                raise RuntimeError("Já existe usuário cadastrado; operação cancelada.")

            company = Company(
                legal_name=legal_name,
                trade_name=trade_name,
                cnpj=cnpj,
                slug=slug,
                is_active=True,
            )
            user = User(
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                is_active=True,
                is_platform_admin=False,
            )
            role = db.scalar(select(Role).where(Role.code == ADMIN_ROLE_CODE))
            if role is None:
                role = Role(
                    code=ADMIN_ROLE_CODE,
                    name=ADMIN_ROLE_NAME,
                    description="Administrador da empresa, limitado ao escopo da transportadora.",
                    is_system=True,
                )
                db.add(role)
                db.flush()

            permissions: list[Permission] = []
            for code, name in INITIAL_PERMISSIONS:
                permission = db.scalar(select(Permission).where(Permission.code == code))
                if permission is None:
                    permission = Permission(code=code, name=name)
                    db.add(permission)
                    db.flush()
                permissions.append(permission)

            db.add_all([company, user])
            db.flush()
            db.add(UserCompanyRole(user_id=user.id, company_id=company.id, role_id=role.id, is_active=True))
            for permission in permissions:
                already_granted = db.scalar(
                    select(RolePermission.id).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == permission.id,
                    )
                )
                if already_granted is None:
                    db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    except Exception as exc:
        print(f"Falha no provisionamento. A transação foi revertida: {exc}", file=sys.stderr)
        return 1

    print("\nProvisionamento concluído.")
    print(f"Empresa: {legal_name} ({slug})")
    print(f"Administrador: {email}")
    print("Agora inicie a API e teste POST /api/v1/auth/login em /docs.")
    print("Por segurança, não imprima nem armazene a senha em arquivos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
