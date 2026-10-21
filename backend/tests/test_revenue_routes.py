from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
COMPANY = "00000000-0000-0000-0000-000000000001"


def test_revenue_list_requires_authentication() -> None:
    response = client.get("/api/v1/revenue", headers={"X-Company-ID": COMPANY})
    assert response.status_code == 401


def test_revenue_create_requires_authentication() -> None:
    response = client.post(
        "/api/v1/revenue",
        headers={"X-Company-ID": COMPANY},
        json={
            "reference": "REC-TEST-001",
            "customer_name": "Cliente de teste",
            "category": "frete_fracionado",
            "description": "Transporte rodoviário",
            "base_amount": "100.00",
            "additions_amount": "0.00",
            "toll_amount": "0.00",
            "discount_amount": "0.00",
        },
    )
    assert response.status_code == 401


def test_revenue_dashboard_requires_authentication() -> None:
    response = client.get("/api/v1/revenue/dashboard", headers={"X-Company-ID": COMPANY})
    assert response.status_code == 401


def test_receivables_require_authentication() -> None:
    response = client.get("/api/v1/revenue/receivables", headers={"X-Company-ID": COMPANY})
    assert response.status_code == 401


def test_receipt_create_requires_authentication() -> None:
    response = client.post(
        "/api/v1/revenue/receipts",
        headers={"X-Company-ID": COMPANY},
        json={
            "payment_date": "2026-10-21",
            "method": "pix",
            "allocations": [{
                "title_id": "00000000-0000-0000-0000-000000000002",
                "amount": "10.00",
            }],
        },
    )
    assert response.status_code == 401
