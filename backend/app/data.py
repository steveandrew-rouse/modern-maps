"""Local demonstration fixtures. Every record is synthetic and not a real incident.

The layer catalogue and scenario records live in data/demo_data.json so the API
and the static frontend build share one source of truth.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "demo_data.json"
_DEMO_DATA = json.loads(_DATA_FILE.read_text(encoding="utf-8"))

LAYERS: list[dict] = _DEMO_DATA["layers"]
DEMO_EVENTS: list[dict] = _DEMO_DATA["events"]


def dashboard_summary() -> dict:
    return {
        "mode": "DEMO",
        "is_live": False,
        "live_sources": 0,
        "demo_scenarios": len(DEMO_EVENTS),
        "layer_groups": len(LAYERS),
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "notice": "All map markers and scenario records are synthetic demonstration data. No live feeds are connected.",
    }
