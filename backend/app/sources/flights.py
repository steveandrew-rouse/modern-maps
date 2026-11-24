"""Live aircraft positions over India from the OpenSky Network."""
from __future__ import annotations

import httpx

from ..models import Signal
from .common import get_json, in_india

NAME = "Air traffic"
PROVIDER = "OpenSky Network"
LICENSE = "OpenSky Network — non-commercial research use"
URL = "https://opensky-network.org/"
CADENCE_SECONDS = 90
SOURCE_ID = "opensky"

FEED = "https://opensky-network.org/api/states/all?lamin=6&lomin=68&lamax=36&lomax=98"
MAX_AIRCRAFT = 140


def _epoch_iso(value: object) -> str | None:
    from datetime import datetime, timezone

    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


async def fetch(client: httpx.AsyncClient) -> list[Signal]:
    payload = await get_json(client, FEED)
    states = payload.get("states") or []
    step = max(1, len(states) // MAX_AIRCRAFT)
    signals: list[Signal] = []
    for state in states[::step][:MAX_AIRCRAFT]:
        if len(state) < 11:
            continue
        callsign = (state[1] or "").strip() or str(state[0])
        country = state[2] or "Unknown"
        lng, lat = state[5], state[6]
        if lng is None or lat is None or not in_india(float(lat), float(lng)):
            continue
        altitude = float(state[7] or state[13] or 0.0)
        velocity = float(state[9] or 0.0)
        # Index 10 is the true track over ground, index 8 the on-ground flag.
        heading = float(state[10] or 0.0)
        on_ground = bool(state[8])
        signals.append(
            Signal(
                id=f"fl-{state[0]}",
                layer="flight",
                title=callsign,
                severity="info",
                lat=float(lat),
                lng=float(lng),
                place=country,
                time=_epoch_iso(state[4] or state[3]),
                provider=PROVIDER,
                source=NAME,
                url="https://opensky-network.org/network/explorer",
                detail=f"Altitude {altitude:.0f} m · speed {velocity * 3.6:.0f} km/h · heading {heading:.0f}°",
                metrics={
                    "altitude_m": altitude,
                    "speed_kmh": velocity * 3.6,
                    "heading_deg": heading,
                    "on_ground": int(on_ground),
                },
            )
        )
    return signals
