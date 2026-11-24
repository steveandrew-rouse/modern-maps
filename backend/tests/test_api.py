from fastapi.testclient import TestClient

from app.aggregate import Aggregator
from app.main import create_app
from app.models import NewsItem, Signal, Snapshot, SourceStatus


def make_snapshot() -> Snapshot:
    return Snapshot(
        generated_at="2026-11-24T00:00:00+00:00",
        signals=[
            Signal(
                id="eq-1", layer="earthquake", title="M5.4 earthquake — Andaman Sea",
                severity="high", lat=12.0, lng=93.0, place="Andaman Sea",
                time="2026-11-23T22:00:00+00:00", provider="U.S. Geological Survey",
                source="Earthquakes", url="https://example.test/eq", metrics={"magnitude": 5.4},
            ),
            Signal(
                id="wx-1", layer="weather", title="New Delhi: 31°C · Clear sky",
                severity="low", lat=28.61, lng=77.21, place="New Delhi, Delhi",
                time="2026-11-23T22:00", provider="Open-Meteo", source="Weather",
                metrics={"temperature_c": 31.0},
            ),
        ],
        news=[NewsItem(id="n-1", title="Headline", url="https://example.test/n", source="Test")],
        counts={"earthquake": 1, "weather": 1, "news": 1},
        sources=[
            SourceStatus(
                id="usgs-earthquakes", name="Earthquakes", provider="U.S. Geological Survey",
                license="Public domain", url="https://example.test", ok=True, records=1,
                last_success="2026-11-24T00:00:00+00:00", cadence_seconds=120,
            )
        ],
    )


def make_client() -> TestClient:
    return TestClient(create_app(Aggregator(initial=make_snapshot()), load_feeds=False))


def test_health_reports_source_health():
    with make_client() as client:
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["sources_total"] == 1
        assert body["sources_ok"] == 1


def test_snapshot_keeps_provenance():
    with make_client() as client:
        body = client.get("/api/v1/snapshot").json()
        assert body["generated_at"].startswith("2026-11-24")
        assert body["signals"][0]["provider"] == "U.S. Geological Survey"


def test_signals_filter_by_layer():
    with make_client() as client:
        response = client.get("/api/v1/signals?layer=weather")
        assert response.status_code == 200
        assert [s["id"] for s in response.json()] == ["wx-1"]


def test_unknown_layer_is_rejected():
    with make_client() as client:
        assert client.get("/api/v1/signals?layer=traffic").status_code == 400


def test_analyst_is_grounded_and_not_an_llm():
    with make_client() as client:
        response = client.post("/api/v1/analyst", json={"question": "What is the earthquake risk?"})
        assert response.status_code == 200
        body = response.json()
        assert body["is_llm"] is False
        assert "USGS" in body["answer"] or "Ground" in body["answer"] or "U.S. Geological Survey" in body["answer"]
        assert body["evidence"][0]["title"].startswith("M5.4")


def test_news_endpoint():
    with make_client() as client:
        assert client.get("/api/v1/news").json()[0]["title"] == "Headline"
