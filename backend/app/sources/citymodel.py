"""City massing model from OpenStreetMap, for the city page's 3D scene.

The city view draws real building footprints and road centrelines instead of a
map with extrusions on top. Buildings come from the OpenStreetMap map API (the
same project as the map data, and far quicker than Overpass for a city block);
the response is parsed server-side and cached. Heights are only ever taken from
OSM tags (``height`` or ``building:levels``) — the frontend labels estimates.
"""
from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ElementTree

import httpx

NAME = "City massing model"
PROVIDER = "OpenStreetMap map API"
LICENSE = "OpenStreetMap contributors — ODbL 1.0"
URL = "https://www.openstreetmap.org/copyright"
SOURCE_ID = "osm-city"

OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map"
USER_AGENT = "india-ai-os-maps/1.0 (city 3d scene)"

ROAD_CLASSES = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "unclassified", "living_street", "pedestrian",
}

QUERY_TTL_SECONDS = 1800
MAX_CACHED_AREAS = 24
MAX_BUILDINGS = 5000
MAX_ROADS = 3000

_HEIGHT_RE = re.compile(r"([0-9]+(?:[.,][0-9]+)?)")

_cache: dict[str, tuple[float, dict]] = {}


def _key(south: float, west: float, north: float, east: float) -> str:
    return f"{south:.4f},{west:.4f},{north:.4f},{east:.4f}"


def _trim_cache() -> None:
    if len(_cache) <= MAX_CACHED_AREAS:
        return
    oldest = sorted(_cache.items(), key=lambda item: item[1][0])[: len(_cache) - MAX_CACHED_AREAS]
    for key, _ in oldest:
        _cache.pop(key, None)


def _number(value: str | None) -> float | None:
    if not value:
        return None
    match = _HEIGHT_RE.search(value.replace(",", "."))
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _area(ring: list[list[float]]) -> float:
    total = 0.0
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def parse_osm(xml: bytes) -> dict:
    """Buildings, roads and water from an OSM map-API XML document."""
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError as exc:
        raise RuntimeError(f"OpenStreetMap returned unreadable XML: {exc}") from exc

    nodes: dict[str, tuple[float, float]] = {}
    for node in root.iter("node"):
        identifier = node.get("id")
        lat, lon = node.get("lat"), node.get("lon")
        if identifier and lat and lon:
            nodes[identifier] = (float(lon), float(lat))

    buildings: list[dict] = []
    roads: list[dict] = []
    water: list[dict] = []

    for way in root.iter("way"):
        tags = {tag.get("k", ""): tag.get("v", "") for tag in way.findall("tag")}
        refs = way.findall("nd")
        if len(refs) < 2:
            continue
        points = []
        for ref in refs:
            node = nodes.get(ref.get("ref", ""))
            if node is not None:
                points.append([round(node[0], 7), round(node[1], 7)])
        if len(points) < 2:
            continue

        if tags.get("building"):
            ring = points[:-1] if points[0] == points[-1] else points
            if len(ring) < 3 or _area(ring) < 1e-10:
                continue
            buildings.append(
                {
                    "ring": ring,
                    "height": _number(tags.get("height")),
                    "levels": _number(tags.get("building:levels")),
                    "class": tags.get("building") or "yes",
                    "name": tags.get("name"),
                }
            )
            continue

        if tags.get("highway") in ROAD_CLASSES:
            roads.append(
                {
                    "line": points,
                    "class": tags["highway"],
                    "name": tags.get("name") or tags.get("ref"),
                    "oneway": tags.get("oneway") in ("yes", "true", "1"),
                }
            )
            continue

        if tags.get("natural") == "water" or tags.get("waterway") == "riverbank":
            ring = points[:-1] if points[0] == points[-1] else points
            if len(ring) >= 3:
                water.append({"ring": ring})

    return {
        "buildings": buildings[:MAX_BUILDINGS],
        "roads": roads[:MAX_ROADS],
        "water": water,
        "truncated": len(buildings) > MAX_BUILDINGS or len(roads) > MAX_ROADS,
    }


async def fetch_city(client: httpx.AsyncClient, *, south: float, west: float, north: float, east: float) -> dict:
    key = _key(south, west, north, east)
    now = time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < QUERY_TTL_SECONDS:
        return cached[1]

    response = await client.get(
        OSM_MAP_URL,
        params={"bbox": f"{west:.6f},{south:.6f},{east:.6f},{north:.6f}"},
        headers={"User-Agent": USER_AGENT},
        timeout=35.0,
    )
    response.raise_for_status()
    model = parse_osm(response.content)
    model.update(
        {
            "centre": [round((west + east) / 2, 6), round((south + north) / 2, 6)],
            "attribution": LICENSE,
        }
    )
    _cache[key] = (now, model)
    _trim_cache()
    return model
