"""Real India headlines from public news RSS feeds (headlines and links only)."""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import NewsItem
from .common import get_text, to_iso

NAME = "News wire"
PROVIDER = "Google News / Times of India"
LICENSE = "Publisher content — headline and link aggregation only"
URL = "https://news.google.com/"
CADENCE_SECONDS = 300
SOURCE_ID = "news-rss"

FEEDS = [
    ("Google News · India", "https://news.google.com/rss/search?q=India&hl=en-IN&gl=IN&ceid=IN:en"),
    ("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"),
]

DC = {"dc": "http://purl.org/dc/elements/1.1/"}


async def fetch(client: httpx.AsyncClient) -> list[NewsItem]:
    items: list[NewsItem] = []
    for feed_name, feed_url in FEEDS:
        try:
            raw = await get_text(client, feed_url)
        except httpx.HTTPError:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for position, item in enumerate(root.iter("item")):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not title or not link:
                continue
            publisher = ""
            source_el = item.find("source")
            if source_el is not None and source_el.text:
                publisher = source_el.text.strip()
            if not publisher and " - " in title:
                title, publisher = title.rsplit(" - ", 1)
            published = item.findtext("pubDate") or item.findtext("dc:date", namespaces=DC)
            items.append(
                NewsItem(
                    id=f"{feed_name[:3]}-{position}-{abs(hash(link)) % 100000}",
                    title=title,
                    url=link,
                    source=publisher.strip() or feed_name,
                    published=to_iso(published),
                )
            )
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in sorted(items, key=lambda n: n.published or "", reverse=True):
        key = item.title.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[:60]
