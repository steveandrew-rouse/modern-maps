"""Shared connector helpers: geography, HTTP and severity rules."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

# south, west, north, east — India plus a narrow offshore margin.
INDIA_BBOX = (6.0, 68.0, 36.0, 98.0)

USER_AGENT = "IndiaAIOSMaps/0.2 (geospatial intelligence dashboard; local deployment)"

CITIES: list[dict[str, Any]] = [
    {"name": "New Delhi", "state": "Delhi", "lat": 28.6139, "lng": 77.2090},
    {"name": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lng": 72.8777},
    {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639},
    {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707},
    {"name": "Bengaluru", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946},
    {"name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867},
    {"name": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714},
    {"name": "Pune", "state": "Maharashtra", "lat": 18.5204, "lng": 73.8567},
    {"name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873},
    {"name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lng": 80.9462},
    {"name": "Guwahati", "state": "Assam", "lat": 26.1445, "lng": 91.7362},
    {"name": "Kochi", "state": "Kerala", "lat": 9.9312, "lng": 76.2673},
]

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_iso(value: str | None) -> str | None:
    """Normalise RFC-822 / ISO timestamps to ISO-8601 UTC strings."""
    if not value:
        return None
    text = value.strip()
    for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.strptime(text, fmt)
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return text


def in_india(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None:
        return False
    south, west, north, east = INDIA_BBOX
    return south <= lat <= north and west <= lng <= east


def severity_rank(severity: str) -> int:
    return SEVERITY_ORDER.get(severity, 9)


async def get_text(client: httpx.AsyncClient, url: str) -> str:
    response = await client.get(url)
    response.raise_for_status()
    return response.text


async def get_json(client: httpx.AsyncClient, url: str) -> Any:
    response = await client.get(url)
    response.raise_for_status()
    return response.json()
