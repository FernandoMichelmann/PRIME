"""Modelos ORM do PRIME. Importar aqui para registrar o metadata do SQLAlchemy."""

from app.models.audit_log import AuditLog
from app.models.authorization import Permission, Role, RolePermission, UserCompanyRole
from app.models.company import Company
from app.models.payroll_employee import PayrollEmployee
from app.models.user import User

__all__ = [
    "AuditLog",
    "Company",
    "PayrollEmployee",
    "Permission",
    "Role",
    "RolePermission",
    "User",
    "UserCompanyRole",
]
