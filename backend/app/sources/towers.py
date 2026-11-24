"""Mobile network towers from OpenStreetMap, queried live through Overpass.

The map tiles used for buildings and roads drop the communication-tower POI
class, so towers come straight from OSM. The browser cannot call Overpass
directly (its responses carry no CORS headers for this origin), so the API
proxies and caches the query.
"""
from __future__ import annotations

import time

import httpx

NAME = "Network towers"
PROVIDER = "OpenStreetMap via Overpass API"
LICENSE = "OpenStreetMap contributors — ODbL 1.0"
URL = "https://www.openstreetmap.org/copyright"
SOURCE_ID = "osm-towers"

# Public Overpass mirrors, tried in order; the main instance rate-limits and
# occasionally returns 502 under load.
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
)
QUERY_TTL_SECONDS = 900
MAX_CACHED_AREAS = 40
MAX_RESULTS = 300

_QUERY = """[out:json][timeout:25];(
node["man_made"="communications_tower"]({s},{w},{n},{e});
node["man_made"="mast"]["tower:type"="communication"]({s},{w},{n},{e});
node["tower:type"="communication"]({s},{w},{n},{e});
);out center {limit};"""

_cache: dict[str, tuple[float, list[dict]]] = {}


def _key(south: float, west: float, north: float, east: float) -> str:
    return f"{south:.3f},{west:.3f},{north:.3f},{east:.3f}"


def _trim_cache() -> None:
    if len(_cache) <= MAX_CACHED_AREAS:
        return
    oldest = sorted(_cache.items(), key=lambda item: item[1][0])[: len(_cache) - MAX_CACHED_AREAS]
    for key, _ in oldest:
        _cache.pop(key, None)


async def fetch_towers(client: httpx.AsyncClient, *, south: float, west: float, north: float, east: float) -> list[dict]:
    key = _key(south, west, north, east)
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < QUERY_TTL_SECONDS:
        return cached[1]

    query = _QUERY.format(s=south, w=west, n=north, e=east, limit=MAX_RESULTS)
    payload = None
    last_error: Exception | None = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = await client.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": "india-ai-os-maps/1.0 (geospatial dashboard)"},
                timeout=12.0,
            )
            response.raise_for_status()
            payload = response.json()
            break
        except (httpx.HTTPError, ValueError) as exc:
            last_error = exc
    if payload is None:
        raise RuntimeError(f"all Overpass mirrors failed: {last_error!r}") from last_error

    towers: list[dict] = []
    for element in payload.get("elements", []):
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lng = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        tags = element.get("tags") or {}
        towers.append(
            {
                "id": f"osm-{element.get('id')}",
                "lat": float(lat),
                "lng": float(lng),
                "name": tags.get("name") or tags.get("operator") or tags.get("ref") or "Mobile network tower",
                "operator": tags.get("operator"),
                "height": tags.get("height"),
                "kind": tags.get("man_made") or tags.get("tower:type") or "tower",
            }
        )

    _cache[key] = (now, towers)
    _trim_cache()
    return towers


def to_geojson(towers: list[dict]) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [tower["lng"], tower["lat"]]},
                "properties": {
                    "id": tower["id"],
                    "name": tower["name"],
                    "operator": tower["operator"],
                    "height": tower["height"],
                    "kind": tower["kind"],
                },
            }
            for tower in towers
        ],
    }
