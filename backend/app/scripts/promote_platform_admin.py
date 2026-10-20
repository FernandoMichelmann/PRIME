"""Promove uma conta existente a administradora da plataforma após confirmação explícita."""
from getpass import getpass
from sqlalchemy import select, func

from app.db.session import SessionLocal
from app.models.user import User


def main() -> int:
    email = input("E-mail da conta existente que será desenvolvedora: ").strip().lower()
    if input("Para continuar, digite PROMOVER: ").strip() != "PROMOVER":
        print("Cancelado.")
        return 1
    with SessionLocal.begin() as db:
        if db.scalar(select(func.count()).select_from(User).where(User.is_platform_admin.is_(True))):
            print("Já existe um administrador da plataforma. Operação bloqueada.")
            return 1
        user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
        if user is None:
            print("Conta ativa não encontrada. Crie primeiro a conta normal do usuário.")
            return 1
        confirmation = getpass("Digite CONFIRMAR para conceder acesso de desenvolvedor: ")
        if confirmation != "CONFIRMAR":
            print("Cancelado.")
            return 1
        user.is_platform_admin = True
    print(f"A conta {email} agora tem acesso à Área do Desenvolvedor.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
