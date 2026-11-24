from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_is_demo():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["mode"] == "demo"


def test_dashboard_does_not_claim_live_sources():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["is_live"] is False
    assert body["live_sources"] == 0


def test_events_are_synthetic():
    response = client.get("/api/events")
    assert response.status_code == 200
    assert response.json()["count"] > 0
    assert all(event["status"] == "SIMULATED" for event in response.json()["events"])


def test_unknown_category_is_rejected():
    response = client.get("/api/events?category=unknown")
    assert response.status_code == 400


def test_analyst_discloses_placeholder_status():
    response = client.post("/api/analyst", json={"question": "How should I assess flood risk?"})
    assert response.status_code == 200
    assert response.json()["is_llm"] is False
