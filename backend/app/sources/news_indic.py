"""Headlines in Indian languages from publisher RSS feeds.

Headline and link only, one item per story, with the language tag carried through
to the API so the UI can filter by language. Feeds are public publisher RSS; the
licences differ by outlet and none permit republishing the article text.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import NewsItem
from .common import get_text, to_iso

NAME = "Indian-language news"
PROVIDER = "BBC · Aaj Tak · News18 · ABP"
LICENSE = "Publisher content — headline and link aggregation only"
URL = "https://www.bbc.com/hindi"
CADENCE_SECONDS = 300
SOURCE_ID = "news-indic"

DC = {"dc": "http://purl.org/dc/elements/1.1/"}

# (language, outlet, feed URL, items to keep)
FEEDS = [
    ("Hindi", "BBC Hindi", "https://feeds.bbci.co.uk/hindi/rss.xml", 8),
    ("Hindi", "Aaj Tak", "https://www.aajtak.in/rssfeeds?id=home", 8),
    ("Tamil", "News18 Tamil", "https://tamil.news18.com/commonfeeds/v1/tam/rss/national.xml", 6),
    ("Telugu", "BBC Telugu", "https://feeds.bbci.co.uk/telugu/rss.xml", 8),
    ("Bengali", "ABP Ananda", "https://bengali.abplive.com/home/feed", 6),
    ("Malayalam", "News18 Malayalam", "https://malayalam.news18.com/commonfeeds/v1/mal/rss/latest.xml", 6),
    ("Kannada", "News18 Kannada", "https://kannada.news18.com/commonfeeds/v1/kan/rss/latest.xml", 6),
    ("Gujarati", "BBC Gujarati", "https://feeds.bbci.co.uk/gujarati/rss.xml", 6),
]


async def fetch(client: httpx.AsyncClient) -> list[NewsItem]:
    items: list[NewsItem] = []
    for language, outlet, feed_url, keep in FEEDS:
        try:
            raw = await get_text(client, feed_url)
        except httpx.HTTPError:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for position, item in enumerate(root.iter("item")):
            if position >= keep:
                break
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if not title or not link:
                continue
            published = item.findtext("pubDate") or item.findtext("dc:date", namespaces=DC)
            items.append(
                NewsItem(
                    id=f"indic-{language[:2]}-{position}-{abs(hash(link)) % 100000}",
                    title=title,
                    url=link,
                    source=outlet,
                    published=to_iso(published),
                    language=language,
                )
            )
    return items
