"""GDACS disaster alerts (UN OCHA) — official multi-hazard RSS feed."""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import Signal
from .common import USER_AGENT, get_text, in_india, to_iso

NAME = "Disaster alerts"
PROVIDER = "GDACS / UN OCHA"
LICENSE = "GDACS public alert feed — attribution to GDACS required"
URL = "https://www.gdacs.org/xml/rss.xml"
CADENCE_SECONDS = 600
SOURCE_ID = "gdacs-alerts"

FEED = "https://www.gdacs.org/xml/rss.xml"

NS = {
    "geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
    "gdacs": "http://www.gdacs.org",
    "dc": "http://purl.org/dc/elements/1.1/",
}

EVENT_LABELS = {
    "EQ": "Earthquake",
    "TC": "Tropical cyclone",
    "FL": "Flood",
    "VO": "Volcano",
    "WF": "Wildfire",
    "DR": "Drought",
}


def _text(node: ET.Element, path: str, ns: dict[str, str] = NS) -> str | None:
    found = node.find(path, ns)
    return found.text.strip() if found is not None and found.text else None


def _severity(alert_level: str | None) -> str:
    level = (alert_level or "").lower()
    if level.startswith("red"):
        return "critical"
    if level.startswith("orange"):
        return "high"
    return "medium"


async def fetch(client: httpx.AsyncClient) -> list[Signal]:
    xml_text = await get_text(client, FEED)
    root = ET.fromstring(xml_text)
    signals: list[Signal] = []
    for item in root.iter("item"):
        lat = _text(item, "geo:Point/geo:lat")
        lng = _text(item, "geo:Point/geo:long")
        try:
            lat_f = float(lat) if lat else None
            lng_f = float(lng) if lng else None
        except ValueError:
            continue
        country = _text(item, "gdacs:country")
        if not in_india(lat_f, lng_f) and "india" not in (country or "").lower():
            continue
        event_type = (_text(item, "gdacs:eventtype") or "").upper()
        alert_level = _text(item, "gdacs:alertlevel")
        title = (_text(item, "title") or "Disaster alert").strip()
        link = _text(item, "link") or URL
        signals.append(
            Signal(
                id=f"gdacs-{(_text(item, 'guid') or title)[:40]}",
                layer="alert",
                title=title,
                severity=_severity(alert_level),
                lat=lat_f,
                lng=lng_f,
                place=country or "India",
                time=to_iso(_text(item, "pubDate")),
                provider=PROVIDER,
                source=NAME,
                url=link,
                detail=_text(item, "description"),
                metrics={
                    "event": EVENT_LABELS.get(event_type, event_type or "Alert"),
                    "alert_level": (alert_level or "green").title(),
                },
            )
        )
    return signals


HEADERS = {"User-Agent": USER_AGENT}
