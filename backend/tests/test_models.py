import app.models  # noqa: F401 — registra os modelos no metadata
from app.db.session import Base


def test_initial_tenant_and_authorization_tables_are_registered() -> None:
    expected = {
        "companies",
        "users",
        "roles",
        "permissions",
        "user_company_roles",
        "role_permissions",
        "audit_logs",
        "payroll_employees",
    }

    assert expected.issubset(set(Base.metadata.tables))


def test_user_company_membership_has_company_and_role_foreign_keys() -> None:
    membership = Base.metadata.tables["user_company_roles"]
    foreign_key_targets = {foreign_key.target_fullname for foreign_key in membership.foreign_keys}

    assert "companies.id" in foreign_key_targets
    assert "users.id" in foreign_key_targets
    assert "roles.id" in foreign_key_targets


def test_payroll_employees_are_scoped_to_a_company() -> None:
    employees = Base.metadata.tables["payroll_employees"]
    foreign_key_targets = {foreign_key.target_fullname for foreign_key in employees.foreign_keys}

    assert "companies.id" in foreign_key_targets
    assert employees.c.company_id.nullable is False
    assert employees.c.name.nullable is False
    assert employees.c.salary.nullable is False
