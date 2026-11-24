"""USGS real-time earthquake feed, filtered to the India bounding box."""
from __future__ import annotations

import httpx

from ..models import Signal
from .common import get_json, in_india, to_iso

NAME = "Earthquakes"
PROVIDER = "U.S. Geological Survey"
LICENSE = "Public domain (U.S. Government work)"
URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
CADENCE_SECONDS = 120
SOURCE_ID = "usgs-earthquakes"

FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"


def _severity(magnitude: float) -> str:
    if magnitude >= 6.0:
        return "critical"
    if magnitude >= 5.0:
        return "high"
    if magnitude >= 4.0:
        return "medium"
    return "low"


async def fetch(client: httpx.AsyncClient) -> list[Signal]:
    payload = await get_json(client, FEED)
    signals: list[Signal] = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        if not in_india(lat, lng):
            continue
        props = feature.get("properties") or {}
        magnitude = float(props.get("mag") or 0.0)
        place = str(props.get("place") or "India region")
        signals.append(
            Signal(
                id=f"eq-{feature.get('id', props.get('code', 'unknown'))}",
                layer="earthquake",
                title=f"M{magnitude:.1f} earthquake — {place}",
                severity=_severity(magnitude),
                lat=lat,
                lng=lng,
                place=place,
                time=to_iso(_epoch_iso(props.get("time"))),
                provider=PROVIDER,
                source=NAME,
                url=str(props.get("url") or URL),
                detail=f"Depth {float(props.get('depth') or 0):.1f} km · {int(props.get('felt') or 0)} felt reports",
                metrics={"magnitude": magnitude, "depth_km": float(props.get("depth") or 0)},
            )
        )
    return signals


def _epoch_iso(value: object) -> str | None:
    try:
        from datetime import datetime, timezone

        return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None
