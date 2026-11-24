from __future__ import annotations

import asyncio

import logging
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from .aggregate import Aggregator
from .analyst import answer
from .models import AnalystRequest, NewsItem, Signal, Snapshot, SourceStatus
from .sources.airports import fetch_airport
from .sources.citymodel import fetch_city
from .sources.towers import fetch_towers, to_geojson

log = logging.getLogger("india-ai-os")

LAYERS = ("earthquake", "alert", "weather", "air", "flight")
SEVERITIES = ("critical", "high", "medium", "low", "info")


def create_app(aggregator: Aggregator | None = None, *, load_feeds: bool = True) -> FastAPI:
    agg = aggregator or Aggregator()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.aggregator = agg
        if load_feeds:
            try:
                await asyncio.wait_for(agg.refresh(), timeout=55)
            except Exception as exc:  # noqa: BLE001 - endpoints report source health
                log.warning("initial feed refresh failed: %s", exc)
        task = asyncio.create_task(agg.loop())
        try:
            yield
        finally:
            task.cancel()

    app = FastAPI(
        title="India AI OS Maps API",
        version="0.2.0",
        description=(
            "Live geospatial intelligence API for India. Aggregates public, key-free sources "
            "(USGS, GDACS/UN OCHA, Open-Meteo, OpenSky, news RSS) with per-record provenance."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def snapshot(request: Request) -> Snapshot:
        return request.app.state.aggregator.snapshot

    @app.get("/health")
    def health(request: Request) -> dict:
        snap = snapshot(request)
        return {
            "status": "ok",
            "service": "india-ai-os-maps-api",
            "version": "0.2.0",
            "generated_at": snap.generated_at,
            "sources_total": len(snap.sources),
            "sources_ok": sum(1 for s in snap.sources if s.ok),
            "signals": len(snap.signals),
        }

    @app.get("/api/v1/snapshot", response_model=Snapshot)
    def get_snapshot(request: Request) -> Snapshot:
        return snapshot(request)

    @app.get("/api/v1/status", response_model=list[SourceStatus])
    def get_status(request: Request) -> list[SourceStatus]:
        return snapshot(request).sources

    @app.get("/api/v1/signals", response_model=list[Signal])
    def get_signals(
        request: Request,
        layer: str | None = Query(default=None),
        severity: str | None = Query(default=None),
        limit: int = Query(default=500, ge=1, le=2000),
    ) -> list[Signal]:
        if layer and layer not in LAYERS:
            raise HTTPException(status_code=400, detail=f"Unknown layer: {layer}")
        if severity and severity not in SEVERITIES:
            raise HTTPException(status_code=400, detail=f"Unknown severity: {severity}")
        signals = snapshot(request).signals
        if layer:
            signals = [s for s in signals if s.layer == layer]
        if severity:
            signals = [s for s in signals if s.severity == severity]
        return signals[:limit]

    @app.get("/api/v1/news", response_model=list[NewsItem])
    def get_news(request: Request, limit: int = Query(default=40, ge=1, le=200)) -> list[NewsItem]:
        return snapshot(request).news[:limit]

    @app.post("/api/v1/refresh", response_model=Snapshot)
    async def force_refresh(request: Request) -> Snapshot:
        return await request.app.state.aggregator.refresh()

    @app.post("/api/v1/analyst")
    def ask_analyst(payload: AnalystRequest, request: Request) -> dict:
        return answer(payload.question, snapshot(request))

    @app.get("/api/v1/towers")
    async def get_towers(
        west: float = Query(ge=-180, le=180),
        south: float = Query(ge=-90, le=90),
        east: float = Query(ge=-180, le=180),
        north: float = Query(ge=-90, le=90),
    ) -> dict:
        """Communication towers in a bounding box, proxied from OpenStreetMap."""
        if east <= west or north <= south:
            raise HTTPException(status_code=400, detail="Invalid bounding box")
        if (east - west) * (north - south) > 4:
            raise HTTPException(status_code=400, detail="Bounding box too large; zoom in further")
        async with httpx.AsyncClient() as client:
            try:
                towers = await fetch_towers(client, south=south, west=west, north=north, east=east)
            except (httpx.HTTPError, ValueError, RuntimeError) as exc:
                raise HTTPException(status_code=502, detail=f"Overpass unavailable: {exc}") from exc
        return to_geojson(towers)

    @app.get("/api/v1/city-model")
    async def get_city_model(
        west: float = Query(ge=-180, le=180),
        south: float = Query(ge=-90, le=90),
        east: float = Query(ge=-180, le=180),
        north: float = Query(ge=-90, le=90),
    ) -> dict:
        """Building footprints, roads and water for the 3D city scene."""
        if east <= west or north <= south:
            raise HTTPException(status_code=400, detail="Invalid bounding box")
        if max(east - west, north - south) > 0.05:
            raise HTTPException(status_code=400, detail="Area too large; pick a smaller city centre")
        async with httpx.AsyncClient() as client:
            try:
                return await asyncio.wait_for(
                    fetch_city(client, south=south, west=west, north=north, east=east), timeout=50,
                )
            except (httpx.HTTPError, ValueError, RuntimeError, TimeoutError) as exc:
                raise HTTPException(status_code=502, detail=f"OpenStreetMap unavailable: {exc}") from exc

    @app.get("/api/v1/airport")
    async def get_airport(icao: str = Query(min_length=4, max_length=4)) -> dict:
        """Recent arrivals and departures recorded for an airport (OpenSky)."""
        if not icao.isalpha():
            raise HTTPException(status_code=400, detail="ICAO code must be four letters")
        async with httpx.AsyncClient() as client:
            try:
                return await fetch_airport(client, icao)
            except (httpx.HTTPError, ValueError, RuntimeError) as exc:
                raise HTTPException(status_code=502, detail=f"OpenSky unavailable: {exc}") from exc

    @app.get("/api/v1/route")
    async def get_route(
        profile: str = Query(pattern="^(foot|bike|driving)$"),
        From: str = Query(alias="from", pattern="^-?[0-9.]+,-?[0-9.]+$"),
        To: str = Query(alias="to", pattern="^-?[0-9.]+,-?[0-9.]+$"),
    ) -> dict:
        """Street routing between two points, proxied to the public OSRM service."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://router.project-osrm.org/route/v1/{profile}/{From};{To}",
                    params={"overview": "full", "geometries": "geojson"},
                    headers={"User-Agent": "india-ai-os-maps/1.0 (travel modes)"},
                    timeout=20.0,
                )
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise HTTPException(status_code=502, detail=f"Routing unavailable: {exc}") from exc
        route = (payload.get("routes") or [None])[0]
        if not route:
            raise HTTPException(status_code=404, detail="No route found")
        return {
            "distance": route.get("distance", 0),
            "duration": route.get("duration", 0),
            "geometry": route.get("geometry"),
            "profile": profile,
        }

    return app


app = create_app()
