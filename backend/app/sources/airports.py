"""Airport activity from OpenSky, for the city page's airport panels.

OpenSky's public state vectors are already used for the map's aircraft layer;
the same API answers arrivals and departures per airport for a time window.
There is no free timetable feed, so the panel shows the tracks OpenSky actually
recorded in the last two hours and says so, rather than inventing schedules.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

NAME = "Airport movements"
PROVIDER = "OpenSky Network"
LICENSE = "OpenSky Network open data"
URL = "https://opensky-network.org"
SOURCE_ID = "opensky-airport"

BASE = "https://opensky-network.org/api/flights"
CACHE_TTL_SECONDS = 600
WINDOW_SECONDS = 7200

_cache: dict[str, tuple[float, dict]] = {}


def _clean(callsign: str | None) -> str:
    return (callsign or "").strip()


def _movement(item: dict, *, arrival: bool) -> dict:
    return {
        "callsign": _clean(item.get("callsign")) or "unknown",
        "icao24": item.get("icao24"),
        "other_airport": item.get("estDepartureAirport") if arrival else item.get("estArrivalAirport"),
        "time": item.get("lastSeen") if arrival else item.get("firstSeen"),
    }


async def fetch_airport(client: httpx.AsyncClient, icao: str) -> dict:
    icao = icao.upper()
    cached = _cache.get(icao)
    now = time.time()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    end = int(now)
    begin = end - WINDOW_SECONDS

    async def call(kind: str) -> list[dict[str, Any]]:
        response = await client.get(
            f"{BASE}/{kind}",
            params={"airport": icao, "begin": begin, "end": end},
            headers={"User-Agent": "india-ai-os-maps/1.0 (airport panel)"},
            timeout=25.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else []

    arrivals = await call("arrival")
    departures = await call("departure")

    data = {
        "icao": icao,
        "window_minutes": WINDOW_SECONDS // 60,
        "arrivals": [_movement(item, arrival=True) for item in arrivals][:20],
        "departures": [_movement(item, arrival=False) for item in departures][:20],
        "provider": PROVIDER,
        "url": URL,
    }
    _cache[icao] = (now, data)
    return data
