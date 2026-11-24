"""Open-Meteo current weather and air quality for major Indian cities."""
from __future__ import annotations

from typing import Any

import httpx

from ..models import Signal
from .common import CITIES, get_json, now_iso

NAME = "Weather & air quality"
PROVIDER = "Open-Meteo"
LICENSE = "CC BY 4.0 (Open-Meteo)"
URL = "https://open-meteo.com/en/docs"
CADENCE_SECONDS = 600
SOURCE_ID = "open-meteo"

FORECAST = "https://api.open-meteo.com/v1/forecast"
AIR = "https://air-quality-api.open-meteo.com/v1/air-quality"

WMO = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain", 71: "Slight snowfall",
    73: "Moderate snowfall", 75: "Heavy snowfall", 80: "Slight showers",
    81: "Moderate showers", 82: "Violent showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
}


def _weather_severity(precipitation: float, temperature: float, wind: float) -> str:
    if precipitation >= 20 or temperature >= 42 or wind >= 60:
        return "high"
    if precipitation >= 7 or temperature >= 38 or wind >= 40:
        return "medium"
    return "low"


def _aqi_severity(aqi: float) -> str:
    if aqi >= 200:
        return "critical"
    if aqi >= 150:
        return "high"
    if aqi >= 100:
        return "medium"
    return "low"


def _rows(payload: Any) -> list[dict[str, Any]]:
    """Open-Meteo returns a single object for one location and a list for many."""
    if isinstance(payload, list):
        return payload
    return [payload]


async def fetch(client: httpx.AsyncClient) -> list[Signal]:
    lats = ",".join(str(city["lat"]) for city in CITIES)
    lngs = ",".join(str(city["lng"]) for city in CITIES)

    forecast = await get_json(
        client,
        f"{FORECAST}?latitude={lats}&longitude={lngs}"
        "&current=temperature_2m,precipitation,wind_speed_10m,weather_code"
        "&timezone=Asia%2FKolkata",
    )
    air = await get_json(
        client,
        f"{AIR}?latitude={lats}&longitude={lngs}"
        "&current=pm2_5,pm10,us_aqi&timezone=Asia%2FKolkata",
    )

    forecast_rows = _rows(forecast)
    air_rows = _rows(air)
    signals: list[Signal] = []

    for index, city in enumerate(CITIES):
        if index >= len(forecast_rows):
            break
        current = forecast_rows[index].get("current") or {}
        temperature = float(current.get("temperature_2m") or 0.0)
        precipitation = float(current.get("precipitation") or 0.0)
        wind = float(current.get("wind_speed_10m") or 0.0)
        code = int(current.get("weather_code") or 0)
        condition = WMO.get(code, f"WMO code {code}")
        signals.append(
            Signal(
                id=f"wx-{city['name'].lower().replace(' ', '-')}",
                layer="weather",
                title=f"{city['name']}: {temperature:.0f}°C · {condition}",
                severity=_weather_severity(precipitation, temperature, wind),
                lat=city["lat"],
                lng=city["lng"],
                place=f"{city['name']}, {city['state']}",
                time=current.get("time") or now_iso(),
                provider=PROVIDER,
                source=NAME,
                url="https://open-meteo.com/",
                detail=f"Rain {precipitation:.1f} mm · wind {wind:.0f} km/h · {condition}",
                metrics={
                    "temperature_c": temperature,
                    "precipitation_mm": precipitation,
                    "wind_kmh": wind,
                    "condition": condition,
                },
            )
        )

        if index < len(air_rows):
            aq = air_rows[index].get("current") or {}
            aqi = float(aq.get("us_aqi") or 0.0)
            pm25 = float(aq.get("pm2_5") or 0.0)
            pm10 = float(aq.get("pm10") or 0.0)
            signals.append(
                Signal(
                    id=f"aq-{city['name'].lower().replace(' ', '-')}",
                    layer="air",
                    title=f"{city['name']}: air quality index {aqi:.0f}",
                    severity=_aqi_severity(aqi),
                    lat=city["lat"],
                    lng=city["lng"],
                    place=f"{city['name']}, {city['state']}",
                    time=aq.get("time") or now_iso(),
                    provider=PROVIDER,
                    source="Air quality (Open-Meteo / CAMS)",
                    url="https://open-meteo.com/en/docs/air-quality-api",
                    detail=f"PM2.5 {pm25:.1f} µg/m³ · PM10 {pm10:.1f} µg/m³ · US AQI",
                    metrics={"us_aqi": aqi, "pm2_5": pm25, "pm10": pm10},
                )
            )
    return signals
