from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_developer_company_list_requires_authentication() -> None:
    response = client.get("/api/v1/developer/companies")
    assert response.status_code == 401


def test_developer_company_creation_requires_authentication() -> None:
    response = client.post(
        "/api/v1/developer/companies",
        json={
            "legal_name": "Transportadora Teste",
            "trade_name": "Teste",
            "cnpj": None,
            "slug": "transportadora-teste",
            "admin_name": "Administrador Teste",
            "admin_email": "admin@example.com",
            "admin_password": "senha-segura-com-12",
        },
    )
    assert response.status_code == 401


def test_developer_status_change_requires_authentication() -> None:
    response = client.patch(
        "/api/v1/developer/companies/00000000-0000-0000-0000-000000000001/status",
        json={"is_active": False},
    )
    assert response.status_code == 401
