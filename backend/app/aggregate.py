"""Background aggregation of the live public feeds."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from .models import NewsItem, Signal, Snapshot, SourceStatus
from .sources import alerts, earthquakes, flights, news, weather
from .sources.common import USER_AGENT, now_iso, severity_rank

log = logging.getLogger("india-ai-os.feeds")

SIGNAL_SOURCES = [earthquakes, alerts, weather, flights]
NEWS_SOURCES = [news]
REFRESH_SECONDS = 120


class Aggregator:
    """Keeps the latest snapshot in memory and refreshes it on a schedule."""

    def __init__(self, initial: Snapshot | None = None) -> None:
        self.snapshot = initial or Snapshot(
            generated_at=now_iso(), signals=[], news=[], counts={}, sources=[]
        )
        self._previous: dict[str, SourceStatus] = {s.id: s for s in self.snapshot.sources}
        self._lock = asyncio.Lock()

    async def refresh(self) -> Snapshot:
        async with self._lock:
            async with httpx.AsyncClient(
                headers={"User-Agent": USER_AGENT},
                timeout=25.0,
                follow_redirects=True,
            ) as client:
                signal_results, news_result = await asyncio.gather(
                    asyncio.gather(*(self._run_signal(client, module) for module in SIGNAL_SOURCES)),
                    self._run_news(client, news),
                )

            statuses: list[SourceStatus] = []
            signals: list[Signal] = []
            for result in signal_results:
                source_status, source_signals = result
                statuses.append(source_status)
                signals.extend(source_signals)

            news_status, news_items = news_result
            statuses.append(news_status)

            signals.sort(key=lambda s: (severity_rank(s.severity), s.time or ""), reverse=False)
            signals.sort(key=lambda s: (severity_rank(s.severity), _desc(s.time)))

            counts: dict[str, int] = {}
            for signal in signals:
                counts[signal.layer] = counts.get(signal.layer, 0) + 1
            counts["news"] = len(news_items)

            self.snapshot = Snapshot(
                generated_at=now_iso(),
                signals=signals,
                news=news_items[:60],
                counts=counts,
                sources=statuses,
            )
            self._previous = {status.id: status for status in statuses}
            log.info(
                "refresh complete: %s signals, %s headlines, %s/%s sources ok",
                len(signals),
                len(news_items),
                sum(1 for s in statuses if s.ok),
                len(statuses),
            )
            return self.snapshot

    async def _run_signal(
        self, client: httpx.AsyncClient, module: Any
    ) -> tuple[SourceStatus, list[Signal]]:
        try:
            records: list[Signal] = await module.fetch(client)
            return self._status(module, True, len(records), None), records
        except Exception as exc:  # noqa: BLE001 - surfaced through status, not raised
            log.warning("%s failed: %s", module.SOURCE_ID, exc)
            return self._status(module, False, 0, str(exc)[:240]), []

    async def _run_news(
        self, client: httpx.AsyncClient, module: Any
    ) -> tuple[SourceStatus, list[NewsItem]]:
        try:
            records: list[NewsItem] = await module.fetch(client)
            return self._status(module, True, len(records), None), records
        except Exception as exc:  # noqa: BLE001
            log.warning("%s failed: %s", module.SOURCE_ID, exc)
            return self._status(module, False, 0, str(exc)[:240]), []

    def _status(self, module: Any, ok: bool, records: int, error: str | None) -> SourceStatus:
        previous = self._previous.get(module.SOURCE_ID)
        return SourceStatus(
            id=module.SOURCE_ID,
            name=module.NAME,
            provider=module.PROVIDER,
            license=module.LICENSE,
            url=module.URL,
            ok=ok,
            records=records,
            last_success=now_iso() if ok else (previous.last_success if previous else None),
            last_error=error,
            cadence_seconds=module.CADENCE_SECONDS,
        )

    async def loop(self) -> None:
        while True:
            await asyncio.sleep(REFRESH_SECONDS)
            try:
                await self.refresh()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                log.error("scheduled refresh failed: %s", exc)


def _desc(value: str | None) -> str:
    return value or ""
