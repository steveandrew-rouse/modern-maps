"""Deterministic, evidence-grounded analyst.

Every answer is composed from the current live snapshot: counts, named records and
provider attribution. No language model is called and nothing is invented.
"""
from __future__ import annotations

from .models import Snapshot

FOCUS_RULES = [
    (("flood", "rain", "monsoon", "cyclone", "disaster", "hazard"),
     "Hazard picture drawn from GDACS alerts and Open-Meteo rainfall observations."),
    (("air", "aqi", "pollution", "pm2.5", "smog"),
     "Air-quality picture drawn from Open-Meteo (CAMS) city readings."),
    (("flight", "aircraft", "air traffic", "plane"),
     "Air-traffic picture drawn from OpenSky Network state vectors."),
    (("earthquake", "quake", "seismic"),
     "Seismic picture drawn from the USGS real-time earthquake feed."),
    (("weather", "temperature", "heat", "wind"),
     "Weather picture drawn from Open-Meteo current conditions."),
    (("news", "headline", "press"),
     "Headline picture drawn from the Google News and Times of India RSS feeds."),
]


def answer(question: str, snapshot: Snapshot) -> dict:
    q = question.lower()
    counts = snapshot.counts
    layer_total = sum(counts.get(key, 0) for key in ("earthquake", "alert", "weather", "air", "flight"))

    focus = "Full-spectrum picture across every connected feed."
    for keywords, text in FOCUS_RULES:
        if any(word in q for word in keywords):
            focus = text
            break

    urgent = [s for s in snapshot.signals if s.severity in ("critical", "high")][:5]
    healthy = [s for s in snapshot.sources if s.ok]
    failing = [s.name for s in snapshot.sources if not s.ok]

    lines = [
        f"Snapshot {snapshot.generated_at}: {layer_total} live geo-signals across "
        f"{len(counts) - (1 if 'news' in counts else 0)} layers, {counts.get('news', 0)} headlines.",
        focus,
    ]

    if urgent:
        lines.append("Highest-severity records right now:")
        for signal in urgent:
            stamp = (signal.time or "time not reported")[:16].replace("T", " ")
            lines.append(f"- {signal.title} ({signal.place or 'location n/a'}), {signal.severity} · {signal.provider} · {stamp} UTC")
    else:
        lines.append("No critical or high severity records are present in the current feeds.")

    if counts.get("weather"):
        hottest = max(
            (s for s in snapshot.signals if s.layer == "weather"),
            key=lambda s: float(s.metrics.get("temperature_c") or 0),
            default=None,
        )
        if hottest:
            lines.append(
                f"Warmest monitored city: {hottest.place} at "
                f"{float(hottest.metrics.get('temperature_c') or 0):.0f}°C."
            )
    if counts.get("air"):
        worst = max(
            (s for s in snapshot.signals if s.layer == "air"),
            key=lambda s: float(s.metrics.get("us_aqi") or 0),
            default=None,
        )
        if worst:
            lines.append(
                f"Highest monitored air-quality index: {worst.place} at US AQI "
                f"{float(worst.metrics.get('us_aqi') or 0):.0f}."
            )

    lines.append(
        f"Source health: {len(healthy)}/{len(snapshot.sources)} connectors reporting"
        + (f"; currently failing: {', '.join(failing)}" if failing else ".")
    )
    lines.append(
        "Limits: these are observations and official alert feeds, not forecasts. "
        "Nothing here is an official warning; always follow IMD and NDMA for advisories."
    )

    evidence = [
        {
            "id": signal.id,
            "title": signal.title,
            "provider": signal.provider,
            "severity": signal.severity,
            "url": signal.url,
        }
        for signal in urgent
    ]

    return {
        "mode": "DETERMINISTIC_GROUNDED",
        "is_llm": False,
        "grounded_at": snapshot.generated_at,
        "answer": "\n".join(lines),
        "evidence": evidence,
        "limitations": [
            "No language model is involved; text is composed from live records.",
            "Feeds cover only their own geography and update cadence.",
            "No forecast, prediction or operational recommendation is produced.",
        ],
    }
