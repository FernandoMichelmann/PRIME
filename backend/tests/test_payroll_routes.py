from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_payroll_employee_list_requires_authentication() -> None:
    response = client.get(
        "/api/v1/payroll/employees",
        headers={"X-Company-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 401


def test_payroll_employee_create_requires_authentication() -> None:
    response = client.post(
        "/api/v1/payroll/employees",
        headers={"X-Company-ID": "00000000-0000-0000-0000-000000000001"},
        json={
            "name": "Funcionário de Teste",
            "tax_id": None,
            "employment_type": "CLT",
            "role": "Motorista",
            "department": "Operação",
            "cost_center": "Frota",
            "start_date": "2026-10-20",
            "salary": "2500.00",
            "is_active": True,
        },
    )
    assert response.status_code == 401


def test_payroll_employee_status_requires_authentication() -> None:
    response = client.patch(
        "/api/v1/payroll/employees/00000000-0000-0000-0000-000000000001/status?is_active=false",
        headers={"X-Company-ID": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 401
