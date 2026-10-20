from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_auth_me_requires_bearer_token() -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_my_companies_requires_bearer_token() -> None:
    response = client.get("/api/v1/auth/companies")

    assert response.status_code == 401


def test_login_rejects_malformed_payload() -> None:
    response = client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "x"})

    assert response.status_code == 422
