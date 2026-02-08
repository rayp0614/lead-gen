"""
ProPublica Nonprofit Explorer API Integration

Provides functions to search for nonprofits and fetch Form 990 PDFs
from ProPublica's public API.

API Documentation: https://projects.propublica.org/nonprofits/api
"""

from __future__ import annotations

import io
import logging
import re
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

# ProPublica API endpoints
PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
PROPUBLICA_SEARCH_URL = f"{PROPUBLICA_API_BASE}/search.json"
PROPUBLICA_ORG_URL = f"{PROPUBLICA_API_BASE}/organizations/{{ein}}.json"

# Rate limiting
RATE_LIMIT_DELAY = 0.5  # seconds between requests
_last_request_time = 0.0

# Cache for search results and org details
_CACHE: Dict[str, Any] = {}
CACHE_TTL = {
    "search": 60 * 60,  # 1 hour
    "org": 24 * 60 * 60,  # 24 hours
    "pdf": 7 * 24 * 60 * 60,  # 7 days
}


@dataclass
class NonprofitSearchResult:
    """A nonprofit organization from ProPublica search results."""
    ein: str
    name: str
    city: str
    state: str
    ntee_code: Optional[str] = None
    subsection_code: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ein": self.ein,
            "name": self.name,
            "city": self.city,
            "state": self.state,
            "ntee_code": self.ntee_code,
            "subsection_code": self.subsection_code,
        }


@dataclass
class Filing:
    """A Form 990 filing from ProPublica."""
    tax_period: str
    pdf_url: Optional[str]
    total_revenue: Optional[int]
    total_expenses: Optional[int]
    total_assets: Optional[int]
    net_assets: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tax_period": self.tax_period,
            "pdf_url": self.pdf_url,
            "total_revenue": self.total_revenue,
            "total_expenses": self.total_expenses,
            "total_assets": self.total_assets,
            "net_assets": self.net_assets,
        }


@dataclass
class FinancialYear:
    """Financial data for a single year."""
    year: str
    revenue: Optional[int]
    expenses: Optional[int]
    net_income: Optional[int]  # Calculated: revenue - expenses
    total_assets: Optional[int]
    net_assets: Optional[int]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict with formatted dollar values."""
        def fmt(val: Optional[int]) -> str:
            if val is None:
                return "N/A"
            prefix = "-" if val < 0 else ""
            return f"{prefix}${abs(val):,}"

        return {
            "year": self.year,
            "revenue": fmt(self.revenue),
            "expenses": fmt(self.expenses),
            "netIncome": fmt(self.net_income),
            "assets": fmt(self.total_assets),
            "netAssets": fmt(self.net_assets),
            # Also include raw values for calculations
            "raw": {
                "revenue": self.revenue,
                "expenses": self.expenses,
                "netIncome": self.net_income,
                "totalAssets": self.total_assets,
                "netAssets": self.net_assets,
            }
        }


@dataclass
class NonprofitDetails:
    """Full nonprofit details including filings."""
    ein: str
    name: str
    city: str
    state: str
    ntee_code: Optional[str]
    filings: List[Filing]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ein": self.ein,
            "name": self.name,
            "city": self.city,
            "state": self.state,
            "ntee_code": self.ntee_code,
            "filings": [f.to_dict() for f in self.filings],
            "latest_filing": self.filings[0].to_dict() if self.filings else None,
        }


def _rate_limit():
    """Ensure we don't exceed ProPublica's rate limits."""
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < RATE_LIMIT_DELAY:
        time.sleep(RATE_LIMIT_DELAY - elapsed)
    _last_request_time = time.time()


def _get_cached(key: str, ttl_key: str):
    """Get cached value if not expired."""
    if key in _CACHE:
        entry = _CACHE[key]
        if time.time() < entry["expires_at"]:
            return entry["value"]
    return None


def _set_cached(key: str, value: Any, ttl_key: str):
    """Cache a value with TTL."""
    _CACHE[key] = {
        "value": value,
        "expires_at": time.time() + CACHE_TTL[ttl_key],
    }


def _http_get(url: str, params: Optional[Dict] = None) -> Dict:
    """Make a rate-limited HTTP GET request."""
    _rate_limit()
    logger.debug("ProPublica API request: %s", url)

    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": "DDSScraper/1.0"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error("ProPublica API error: %s", str(e))
        raise


def search_nonprofits(
    query: str,
    state: str = "CT",
    page: int = 0
) -> List[NonprofitSearchResult]:
    """
    Search for nonprofits by name.

    Args:
        query: Organization name to search for
        state: Two-letter state code (default: CT)
        page: Page number for pagination (default: 0)

    Returns:
        List of matching nonprofit organizations
    """
    cache_key = f"search:{query.lower()}:{state}:{page}"
    cached = _get_cached(cache_key, "search")
    if cached is not None:
        logger.debug("Cache hit for search: %s", query)
        return cached

    logger.info("Searching ProPublica for: %s (state=%s)", query, state)

    params = {
        "q": query,
        "state[id]": state,
        "page": page,
    }

    try:
        data = _http_get(PROPUBLICA_SEARCH_URL, params)
    except Exception as e:
        logger.error("ProPublica search failed: %s", str(e))
        return []

    organizations = data.get("organizations", [])
    results = []

    for org in organizations:
        result = NonprofitSearchResult(
            ein=org.get("ein", ""),
            name=org.get("name", ""),
            city=org.get("city", ""),
            state=org.get("state", ""),
            ntee_code=org.get("ntee_code"),
            subsection_code=org.get("subsection_code"),
        )
        results.append(result)

    logger.info("Found %d results for: %s", len(results), query)
    _set_cached(cache_key, results, "search")
    return results


def get_nonprofit_details(ein: str) -> Optional[NonprofitDetails]:
    """
    Get full details for a nonprofit by EIN.

    Args:
        ein: 9-digit EIN (with or without hyphen)

    Returns:
        NonprofitDetails with filings, or None if not found
    """
    # Normalize EIN (remove hyphen if present)
    ein = ein.replace("-", "")

    cache_key = f"org:{ein}"
    cached = _get_cached(cache_key, "org")
    if cached is not None:
        logger.debug("Cache hit for org: %s", ein)
        return cached

    logger.info("Fetching ProPublica details for EIN: %s", ein)

    url = PROPUBLICA_ORG_URL.format(ein=ein)

    try:
        data = _http_get(url, None)
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            logger.warning("Organization not found: %s", ein)
            return None
        raise
    except Exception as e:
        logger.error("ProPublica org fetch failed: %s", str(e))
        return None

    org = data.get("organization", {})
    filings_data = data.get("filings_with_data", [])

    filings = []

    # Check if organization has newer data than the filings
    # The org object often has the latest year before it appears in filings_with_data
    org_tax_period = org.get("tax_period", "")  # Format: "2024-06-01"
    if org_tax_period:
        # Extract year from tax_period (e.g., "2024-06-01" -> 2024)
        try:
            org_year = int(org_tax_period.split("-")[0])
            org_revenue = org.get("revenue_amount")
            org_assets = org.get("asset_amount")
            org_income = org.get("income_amount")

            # Check if this year is newer than what's in filings
            first_filing_year = filings_data[0].get("tax_prd_yr", 0) if filings_data else 0

            if org_year > first_filing_year and org_revenue:
                # Add the latest year from organization data
                # Note: org doesn't have expenses, so we calculate from income
                # income_amount appears to be gross income, not net
                # We'll estimate expenses as revenue - (a reasonable margin)
                # Actually, let's check if totfuncexpns is in org... it's not
                # So we'll just use what we have and mark expenses as N/A
                logger.info(f"Adding latest year {org_year} from organization data (not yet in filings)")
                latest_filing = Filing(
                    tax_period=str(org_year),
                    pdf_url=None,
                    total_revenue=org_revenue,
                    total_expenses=None,  # Not available in org summary
                    total_assets=org_assets,
                    net_assets=None,
                )
                filings.append(latest_filing)
        except (ValueError, IndexError) as e:
            logger.debug(f"Could not parse org tax_period: {e}")

    for f in filings_data:
        filing = Filing(
            tax_period=str(f.get("tax_prd_yr", "")),
            pdf_url=f.get("pdf_url"),
            total_revenue=f.get("totrevenue"),
            total_expenses=f.get("totfuncexpns"),
            total_assets=f.get("totassetsend"),
            net_assets=f.get("totnetassetsend"),
        )
        filings.append(filing)

    # Sort filings by year (most recent first)
    filings.sort(key=lambda f: f.tax_period, reverse=True)

    details = NonprofitDetails(
        ein=org.get("ein", ein),
        name=org.get("name", ""),
        city=org.get("city", ""),
        state=org.get("state", ""),
        ntee_code=org.get("ntee_code"),
        filings=filings,
    )

    _set_cached(cache_key, details, "org")
    return details


def fetch_form990_pdf(ein: str, year: Optional[int] = None) -> Optional[bytes]:
    """
    Download Form 990 PDF for an organization.

    Args:
        ein: 9-digit EIN
        year: Tax year (default: most recent available with PDF)

    Returns:
        PDF bytes, or None if not available
    """
    ein = ein.replace("-", "")
    cache_key = f"pdf:{ein}:{year or 'latest'}"
    cached = _get_cached(cache_key, "pdf")
    if cached is not None:
        logger.debug("Cache hit for PDF: %s", ein)
        return cached

    # Get org details to find PDF URL
    details = get_nonprofit_details(ein)
    if not details or not details.filings:
        logger.warning("No filings found for EIN: %s", ein)
        return None

    # Find the requested year or find most recent with a PDF URL
    filing = None
    if year:
        for f in details.filings:
            if f.tax_period == str(year):
                filing = f
                break
        if not filing:
            logger.warning("No filing found for year %d, EIN: %s", year, ein)
            return None
        if not filing.pdf_url:
            logger.warning("No PDF URL for requested year %d, EIN: %s", year, ein)
            return None
    else:
        # Find the most recent filing that has a PDF URL
        for f in details.filings:
            if f.pdf_url:
                filing = f
                logger.info("Found PDF for year %s (most recent with PDF)", f.tax_period)
                break
        if not filing:
            logger.warning("No filings with PDF URLs for EIN: %s", ein)
            return None

    if not filing.pdf_url:
        logger.warning("No PDF URL for EIN: %s, year: %s", ein, filing.tax_period)
        return None

    logger.info("Fetching Form 990 PDF: %s (year %s)", ein, filing.tax_period)

    _rate_limit()
    try:
        resp = requests.get(
            filing.pdf_url,
            headers={"User-Agent": "DDSScraper/1.0"},
            timeout=60,
        )
        resp.raise_for_status()
        pdf_bytes = resp.content
        _set_cached(cache_key, pdf_bytes, "pdf")
        logger.info("Downloaded PDF: %d bytes", len(pdf_bytes))
        return pdf_bytes
    except Exception as e:
        logger.error("PDF download failed: %s", str(e))
        return None


def normalize_org_name(name: str) -> str:
    """Normalize organization name for fuzzy matching."""
    name = name.lower()
    # Remove common suffixes
    suffixes = [
        r'\binc\.?\b', r'\bincorporated\b', r'\bllc\b', r'\bcorp\.?\b',
        r'\bcorporation\b', r'\bltd\.?\b', r'\bco\.?\b', r'\bfoundation\b',
    ]
    for suffix in suffixes:
        name = re.sub(suffix, '', name)
    # Remove punctuation and extra whitespace
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def calculate_similarity(name1: str, name2: str) -> float:
    """Calculate similarity score between two organization names."""
    norm1 = normalize_org_name(name1)
    norm2 = normalize_org_name(name2)

    # Use SequenceMatcher for fuzzy matching
    return SequenceMatcher(None, norm1, norm2).ratio()


def match_to_dds_provider(
    propublica_name: str,
    dds_providers: List[Dict[str, str]],
    threshold: float = 0.6
) -> Optional[Dict[str, str]]:
    """
    Find the best matching DDS provider for a ProPublica organization.

    Uses multiple strategies:
    1. Fuzzy name similarity (SequenceMatcher)
    2. Check if normalized DDS name is contained in normalized ProPublica name
    3. Check if normalized ProPublica name is contained in normalized DDS name

    Args:
        propublica_name: Organization name from ProPublica
        dds_providers: List of DDS providers with 'name' and 'url' keys
        threshold: Minimum similarity score (0.0 to 1.0)

    Returns:
        Best matching DDS provider, or None if no good match
    """
    best_match = None
    best_score = 0.0
    norm_propublica = normalize_org_name(propublica_name)

    for provider in dds_providers:
        norm_dds = normalize_org_name(provider["name"])

        # Strategy 1: Fuzzy similarity
        score = calculate_similarity(propublica_name, provider["name"])

        # Strategy 2: Check containment (DDS name in ProPublica name)
        # This helps with "March Inc Of Manchester C/O Robert F Gorman" matching "March, Inc. of Manchester"
        if norm_dds in norm_propublica or norm_propublica in norm_dds:
            # Boost score if one name contains the other
            containment_score = len(norm_dds) / max(len(norm_propublica), 1)
            score = max(score, 0.75 + (containment_score * 0.2))

        if score > best_score:
            best_score = score
            best_match = provider

    if best_score >= threshold:
        logger.info(
            "Matched '%s' to DDS provider '%s' (score: %.2f)",
            propublica_name, best_match["name"], best_score
        )
        return best_match

    logger.debug(
        "No DDS match for '%s' (best score: %.2f)",
        propublica_name, best_score
    )
    return None


def get_financial_history(ein: str, years: int = 5) -> List[FinancialYear]:
    """
    Get structured financial history for an organization.

    This function fetches financial data directly from ProPublica's API,
    providing reliable data without requiring AI parsing.

    Args:
        ein: 9-digit EIN (with or without hyphen)
        years: Number of years of history to return (default: 5)

    Returns:
        List of FinancialYear objects, most recent first.
        Each year includes revenue, expenses, net income (calculated),
        total assets, and net assets.
    """
    ein = ein.replace("-", "")
    logger.info("Fetching %d-year financial history for EIN: %s", years, ein)

    # Get org details which includes filings
    details = get_nonprofit_details(ein)
    if not details:
        logger.warning("No organization found for EIN: %s", ein)
        return []

    if not details.filings:
        logger.warning("No filings found for EIN: %s", ein)
        return []

    # Extract financial data from filings
    financial_years: List[FinancialYear] = []

    for filing in details.filings[:years]:
        # Calculate net income if we have both revenue and expenses
        net_income = None
        if filing.total_revenue is not None and filing.total_expenses is not None:
            net_income = filing.total_revenue - filing.total_expenses

        fy = FinancialYear(
            year=filing.tax_period,
            revenue=filing.total_revenue,
            expenses=filing.total_expenses,
            net_income=net_income,
            total_assets=filing.total_assets,
            net_assets=filing.net_assets,
        )
        financial_years.append(fy)

    logger.info(
        "Retrieved %d years of financial data for %s",
        len(financial_years), details.name
    )

    return financial_years


def get_financial_summary(ein: str) -> Dict[str, Any]:
    """
    Get a complete financial summary for an organization.

    Returns structured data ready for display or export, including:
    - Organization info (name, EIN, city, state)
    - 5-year financial history
    - Latest filing details

    Args:
        ein: 9-digit EIN

    Returns:
        Dictionary with organization info and financial history
    """
    ein = ein.replace("-", "")
    details = get_nonprofit_details(ein)

    if not details:
        return {
            "error": f"Organization not found for EIN: {ein}",
            "ein": ein,
        }

    financial_history = get_financial_history(ein)

    return {
        "ein": details.ein,
        "name": details.name,
        "city": details.city,
        "state": details.state,
        "ntee_code": details.ntee_code,
        "financialHistory": [fy.to_dict() for fy in financial_history],
        "yearsAvailable": len(financial_history),
        "latestYear": financial_history[0].year if financial_history else None,
        "propublicaUrl": f"https://projects.propublica.org/nonprofits/organizations/{ein}",
    }
