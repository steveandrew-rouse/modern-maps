"""Place search and approximate network location, from key-free public services.

Nominatim (OpenStreetMap) answers free-text place searches. Its usage policy asks
clients to identify themselves and to stay around one request per second, so the
dashboard proxies and caches lookups instead of calling it from every browser.
ipwho.is answers a coarse, city-level position for the caller's public IP; it is
never a precise device location and the UI labels it that way.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

USER_AGENT = "modern-map/1.0 (public dashboard; place search)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
IP_URL = "https://ipwho.is/"

CACHE_TTL_SECONDS = 600.0

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


async def search_places(client: httpx.AsyncClient, query: str, limit: int = 8) -> list[dict[str, Any]]:
    key = query.strip().lower()
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    response = await client.get(
        NOMINATIM_URL,
        params={
            "q": query,
            "format": "jsonv2",
            "limit": limit,
            "addressdetails": 1,
            "accept-language": "en",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=15.0,
    )
    response.raise_for_status()
    payload = response.json()

    hits: list[dict[str, Any]] = []
    for item in payload if isinstance(payload, list) else []:
        try:
            lat = float(item["lat"])
            lng = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        display = str(item.get("display_name") or "")
        hits.append(
            {
                "name": str(item.get("name") or display.split(",")[0] or "Unnamed place"),
                "display_name": display,
                "kind": str(item.get("type") or item.get("category") or "place"),
                "country": (item.get("address") or {}).get("country"),
                "lat": lat,
                "lng": lng,
            }
        )

    _cache[key] = (now, hits)
    return hits


async def network_location(client: httpx.AsyncClient) -> dict[str, Any]:
    response = await client.get(IP_URL, headers={"User-Agent": USER_AGENT}, timeout=10.0)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not payload.get("success", False):
        message = (payload or {}).get("message") if isinstance(payload, dict) else None
        raise RuntimeError(str(message or "IP lookup failed"))
    return {
        "lat": payload.get("latitude"),
        "lng": payload.get("longitude"),
        "city": payload.get("city"),
        "region": payload.get("region"),
        "country": payload.get("country"),
        "accuracy": "city-level, from the public IP address",
        "provider": "ipwho.is",
    }
