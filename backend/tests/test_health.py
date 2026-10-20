from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_liveness_returns_ok() -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "prime-api"}


def test_openapi_is_available_in_development() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "PRIME API"
