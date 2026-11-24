"""Typed records exposed by the India AI OS Maps API."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Layer = Literal["earthquake", "alert", "weather", "air", "flight", "news"]
Severity = Literal["critical", "high", "medium", "low", "info"]


class Signal(BaseModel):
    id: str
    layer: Layer
    title: str
    severity: Severity
    lat: float | None = None
    lng: float | None = None
    place: str = ""
    time: str | None = None
    provider: str
    source: str
    url: str | None = None
    detail: str | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class NewsItem(BaseModel):
    id: str
    title: str
    url: str
    source: str
    published: str | None = None
    language: str = "en"


class SourceStatus(BaseModel):
    id: str
    name: str
    provider: str
    license: str
    url: str
    ok: bool
    records: int
    last_success: str | None = None
    last_error: str | None = None
    cadence_seconds: int


class Snapshot(BaseModel):
    generated_at: str
    signals: list[Signal]
    news: list[NewsItem]
    counts: dict[str, int]
    sources: list[SourceStatus]


class AnalystRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
