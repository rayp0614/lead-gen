from __future__ import annotations

import io
import logging
import re
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import pdfplumber
import requests
from bs4 import BeautifulSoup

# Configure module logger
logger = logging.getLogger(__name__)

BASE_URL = "https://portal.ct.gov/dds/searchable-archive/providerprofile/general/provider-by-town?language=en_US"
TOWN_PDF_PREFIX = "https://portal.ct.gov/-/media/DDS/provider_town/"
PROFILE_PDF_PREFIX = "https://portal.ct.gov/-/media/DDS/provider_alpha/"

URL_RE = re.compile(r"https?://\S+?\.pdf", re.IGNORECASE)
DATE_RE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")

HEADINGS = {
    "DDS QUALIFIED PROVIDERS BY TOWN",
    "PROVIDER NAME",
    "LINK TO PROVIDER PROFILE",
    "DDS QUALIFIED PROVIDERS",
    "QUALIFIED PROVIDERS BY TOWN",
}


@dataclass
class CacheEntry:
    value: object
    expires_at: float


_CACHE: Dict[str, CacheEntry] = {}


def _cached(key: str, ttl_seconds: int, loader: Callable[[], object]) -> object:
    now = time.time()
    entry = _CACHE.get(key)
    if entry and entry.expires_at > now:
        return entry.value
    value = loader()
    _CACHE[key] = CacheEntry(value=value, expires_at=now + ttl_seconds)
    return value


def _http_get(url: str) -> bytes:
    logger.debug("Fetching URL: %s", url)
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "DDSScraper/1.0 (+https://portal.ct.gov)"},
            timeout=30,
        )
        resp.raise_for_status()
        logger.debug("Successfully fetched %s (%d bytes)", url, len(resp.content))
        return resp.content
    except requests.RequestException as e:
        logger.error("HTTP request failed for %s: %s", url, str(e))
        raise


def _normalize_town(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def get_towns() -> List[Dict[str, str]]:
    def loader() -> List[Dict[str, str]]:
        logger.info("Fetching towns list from DDS portal")
        html = _http_get(BASE_URL).decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        towns = []
        for a in soup.find_all("a"):
            href = (a.get("href") or "").strip()
            text = (a.get_text() or "").strip()
            if not href:
                continue
            if "provider_town" not in href.lower():
                continue
            if ".pdf" not in href.lower():
                continue
            full_url = urljoin(BASE_URL, href)
            name = text or _infer_name_from_url(full_url)
            towns.append({"name": name, "pdf_url": full_url})
        towns.sort(key=lambda x: x["name"].lower())
        logger.info("Found %d towns with provider PDFs", len(towns))
        return towns

    return _cached("towns", 24 * 60 * 60, loader)  # 24 hours


def get_town_pdf_url(town: str) -> Optional[str]:
    town_key = _normalize_town(town)
    for item in get_towns():
        if _normalize_town(item["name"]) == town_key:
            return item["pdf_url"]
    return None


def _is_allowed_pdf(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    # Allow portal.ct.gov and www.ct.gov (both used for DDS documents)
    allowed_hosts = {"portal.ct.gov", "www.ct.gov", "ct.gov"}
    if parsed.netloc.lower() not in allowed_hosts:
        return False
    lower = url.lower()
    # Allow provider profiles, town lists, and quality service reviews
    return (
        "/provider_town/" in lower or
        "/provider_alpha/" in lower or
        "/qsr/" in lower or
        "/dds/" in lower or  # Broader DDS path
        "quality" in lower  # Quality reports may have various paths
    )


# Regex to find Quality Profile URLs in provider PDFs
QUALITY_PROFILE_RE = re.compile(
    r"https?://[^\s]+(?:qsr|quality)[^\s]*\.pdf",
    re.IGNORECASE
)


def _clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())


def _is_candidate_name(line: str, town_name: str) -> bool:
    if not line:
        return False
    if "http://" in line or "https://" in line:
        return False
    upper = line.upper()
    if upper in HEADINGS:
        return False
    if DATE_RE.search(line):
        return False
    if line.isdigit():
        return False
    if town_name and upper == town_name.upper():
        return False
    if len(line) <= 2:
        return False
    return True


def _infer_name_from_url(url: str) -> str:
    name = url.split("/")[-1]
    name = re.sub(r"\\.pdf$", "", name, flags=re.IGNORECASE)
    name = name.replace("_pp", "").replace("-", " ")
    name = name.replace("_", " ")
    return name.strip().title() if name else "provider"


def parse_providers_from_town_pdf(pdf_bytes: bytes, town_name: str) -> List[Dict[str, str]]:
    lines: List[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw in text.splitlines():
                cleaned = _clean_line(raw)
                if cleaned:
                    lines.append(cleaned)

    providers: List[Dict[str, str]] = []
    seen_urls = set()
    last_name: Optional[str] = None

    for line in lines:
        if "(" in line and line.strip().startswith("(") and providers:
            # Continuation line like "(Channel 3 Kids Camp)"
            providers[-1]["name"] = f"{providers[-1]['name']} {line}".strip()
            continue

        match = URL_RE.search(line)
        if match:
            url = match.group(0)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            name_part = line[: match.start()].strip()
            name = None
            if _is_candidate_name(name_part, town_name):
                name = name_part
            elif last_name and _is_candidate_name(last_name, town_name):
                name = last_name

            providers.append({"name": name or _infer_name_from_url(url), "url": url})
            last_name = name or last_name
            continue

        # Track potential name lines for cases where URL is on the next line (rare)
        if _is_candidate_name(line, town_name):
            last_name = line

    return providers


def get_providers_for_town(town: str) -> List[Dict[str, str]]:
    logger.info("Getting providers for town: %s", town)
    pdf_url = get_town_pdf_url(town)
    if not pdf_url:
        logger.warning("No PDF URL found for town: %s", town)
        return []

    cache_key = f"providers::{_normalize_town(town)}"

    def loader() -> List[Dict[str, str]]:
        pdf_bytes = _http_get(pdf_url)
        providers = parse_providers_from_town_pdf(pdf_bytes, town)
        logger.info("Parsed %d providers for town: %s", len(providers), town)
        return providers

    return _cached(cache_key, 6 * 60 * 60, loader)  # 6 hours


def fetch_pdf(url: str) -> bytes:
    if not _is_allowed_pdf(url):
        logger.warning("Blocked PDF fetch attempt for disallowed URL: %s", url)
        raise ValueError("URL not allowed")
    logger.info("Fetching PDF from: %s", url)
    return _http_get(url)


def extract_quality_profile_url(provider_pdf_bytes: bytes) -> Optional[str]:
    """
    Extract Quality Profile URL from a provider profile PDF.

    The quality profile link is typically at the bottom of the provider PDF.

    Args:
        provider_pdf_bytes: The provider profile PDF content

    Returns:
        Quality profile URL if found, None otherwise
    """
    logger.debug("Extracting quality profile URL from provider PDF")

    try:
        with pdfplumber.open(io.BytesIO(provider_pdf_bytes)) as pdf:
            # Check all pages, but quality link is usually on the last page
            for page in reversed(pdf.pages):
                text = page.extract_text() or ""

                # Look for quality profile URL pattern
                match = QUALITY_PROFILE_RE.search(text)
                if match:
                    url = match.group(0)
                    logger.info("Found quality profile URL: %s", url)
                    return url

                # Also check hyperlinks embedded in the PDF
                if hasattr(page, 'hyperlinks'):
                    for link in page.hyperlinks or []:
                        uri = link.get('uri', '')
                        if uri and ('qsr' in uri.lower() or 'quality' in uri.lower()):
                            logger.info("Found quality profile hyperlink: %s", uri)
                            return uri

    except Exception as e:
        logger.error("Error extracting quality profile URL: %s", str(e))

    logger.debug("No quality profile URL found in provider PDF")
    return None


def get_all_providers_flat() -> List[Dict[str, str]]:
    """
    Get all DDS providers from all towns as a flat list.

    Cached for 6 hours to avoid repeated slow fetches.

    Returns:
        List of all providers with name, url, and town fields
    """
    def loader() -> List[Dict[str, str]]:
        logger.info("Building flat list of all DDS providers (this may take a while...)")
        all_providers = []

        towns = get_towns()
        for i, town in enumerate(towns):
            logger.debug("Processing town %d/%d: %s", i + 1, len(towns), town["name"])
            providers = get_providers_for_town(town["name"])
            for provider in providers:
                all_providers.append({
                    "name": provider["name"],
                    "url": provider["url"],
                    "town": town["name"],
                })

        logger.info("Total providers across all towns: %d", len(all_providers))
        return all_providers

    return _cached("all_providers_flat", 6 * 60 * 60, loader)  # 6 hours
