from __future__ import annotations

from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .data import DEMO_EVENTS, LAYERS, dashboard_summary

app = FastAPI(
    title="India AI OS Maps API",
    version="0.1.0",
    description=(
        "Local demonstration API for the India AI OS Maps geospatial intelligence concept. "
        "All records are synthetic; no official or live data feeds are connected."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class AnalystRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    scope: Literal["india", "selected_region"] = "india"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "india-ai-os-maps-api", "mode": "demo"}


@app.get("/api/dashboard")
def get_dashboard() -> dict:
    return dashboard_summary()


@app.get("/api/layers")
def get_layers() -> dict:
    return {"mode": "demo", "layers": LAYERS}


@app.get("/api/events")
def get_events(category: str | None = Query(default=None)) -> dict:
    allowed = {layer["id"] for layer in LAYERS}
    if category and category not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
    events = DEMO_EVENTS if category is None else [e for e in DEMO_EVENTS if e["category"] == category]
    return {"mode": "demo", "count": len(events), "events": events}


@app.post("/api/analyst")
def ask_analyst(payload: AnalystRequest) -> dict:
    """Transparent placeholder; replace with evidence-grounded retrieval/model orchestration."""
    q = payload.question.lower()
    if any(word in q for word in ("flood", "rain", "cyclone", "disaster")):
        focus = "For a real hazard assessment, ingest timestamped official warnings and hydrology observations, verify the affected geography, and display the issuing agency and validity window."
    elif any(word in q for word in ("traffic", "road", "rail", "metro", "transport")):
        focus = "For transport analysis, connect an authorized traffic or transit feed, normalize its update cadence, and compare observations with a documented historical baseline."
    elif any(word in q for word in ("energy", "power", "grid")):
        focus = "For grid analysis, use utility-authorized aggregate telemetry and clearly distinguish measured load, estimates and simulated stress tests."
    else:
        focus = "A production analyst should retrieve relevant verified datasets, compare timestamps and geographic coverage, cite every source, and report uncertainty before making a recommendation."

    return {
        "mode": "DEMO_RULE_BASED_PLACEHOLDER",
        "is_llm": False,
        "answer": (
            "This starter is not connected to live national datasets or a language model. "
            "The current map contains synthetic scenarios only. " + focus
        ),
        "evidence": [],
        "limitations": [
            "No live sources connected", "No predictive model validated", "No operational recommendation produced"
        ],
    }
