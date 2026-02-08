from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import scraper
import propublica

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# CORS configuration - restrict to specific origins
# Set ALLOWED_ORIGINS env var as comma-separated list for production
# Default allows localhost for development (common React/Vite ports)
DEFAULT_ORIGINS = (
    "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174,"
    "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173,http://127.0.0.1:5174"
)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")

# In production (Railway), allow all origins for simplicity
# You can restrict this by setting ALLOWED_ORIGINS env var to your frontend URL
ALLOW_ALL_ORIGINS = os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("ALLOW_ALL_ORIGINS")

app = FastAPI(title="DDS Provider Scraper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ALL_ORIGINS else ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    logger.debug("Health check requested")
    return {"status": "ok"}


@app.get("/api/towns")
def towns() -> dict:
    logger.info("Fetching towns list")
    return {"towns": scraper.get_towns()}


@app.get("/api/providers")
def providers(town: str = Query(..., min_length=1)) -> dict:
    logger.info("Fetching providers for town: %s", town)
    results = scraper.get_providers_for_town(town)
    if not results:
        logger.warning("No providers found for town: %s", town)
        raise HTTPException(status_code=404, detail="Town not found or no providers parsed.")
    logger.info("Returning %d providers for town: %s", len(results), town)
    return {"town": town, "providers": results}


@app.get("/api/fetch-pdf")
def fetch_pdf(url: str = Query(..., min_length=10), name: str | None = None) -> Response:
    logger.info("PDF fetch requested: %s", url)
    try:
        data = scraper.fetch_pdf(url)
    except ValueError as exc:
        logger.warning("PDF fetch blocked (invalid URL): %s - %s", url, str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF fetch failed: %s - %s", url, str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch PDF.") from exc

    filename = "provider.pdf"
    if name:
        safe_name = "".join(ch for ch in name if ch.isalnum() or ch in (" ", "-", "_")).strip()
        if safe_name:
            filename = f"{safe_name}.pdf"

    logger.info("Returning PDF: %s (%d bytes)", filename, len(data))
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=data, media_type="application/pdf", headers=headers)


# =============================================================================
# Unified Search & Auto-Fetch Endpoints
# =============================================================================


class FetchDocsRequest(BaseModel):
    """Request body for fetching all documents for an organization."""
    ein: str
    org_name: Optional[str] = None  # For DDS matching
    city: Optional[str] = None  # For DDS matching by town
    provider_url: Optional[str] = None  # Direct URL if known


class FetchDocsResponse(BaseModel):
    """Response with base64-encoded documents."""
    form990: Optional[str] = None
    form990_year: Optional[str] = None
    provider_profile: Optional[str] = None
    quality_report: Optional[str] = None
    org_name: Optional[str] = None
    errors: List[str] = []


@app.get("/api/search/unified")
def unified_search(q: str = Query(..., min_length=2), state: str = "CT") -> dict:
    """
    Search for organizations via ProPublica with DDS matching.

    DDS matching is done per-city (not all towns) for fast results.
    """
    logger.info("Unified search: q='%s', state='%s'", q, state)

    # Search ProPublica
    propublica_results = propublica.search_nonprofits(q, state)

    # Cache of DDS providers by city (to avoid re-fetching same city)
    dds_cache: dict = {}

    results = []
    for org in propublica_results:
        result = {
            "ein": org.ein,
            "name": org.name,
            "city": org.city,
            "state": org.state,
            "ntee_code": org.ntee_code,
            "propublica_url": f"https://projects.propublica.org/nonprofits/organizations/{org.ein}",
            "dds_provider": None,
            "has_form990": True,
        }

        # Try to match DDS provider for this city
        if org.city:
            try:
                # Get providers for this city (cached within this request)
                if org.city not in dds_cache:
                    dds_cache[org.city] = scraper.get_providers_for_town(org.city)

                providers = dds_cache[org.city]
                if providers:
                    match = propublica.match_to_dds_provider(org.name, providers)
                    if match:
                        result["dds_provider"] = {
                            "name": match["name"],
                            "url": match["url"],
                            "town": org.city,
                        }
            except Exception as e:
                logger.debug("DDS lookup failed for %s: %s", org.city, str(e))

        results.append(result)

    logger.info("Unified search returned %d results", len(results))
    return {"results": results, "query": q, "state": state}


@app.get("/api/organization/{ein}")
def get_organization(ein: str) -> dict:
    """
    Get detailed organization info from ProPublica by EIN.
    """
    logger.info("Fetching organization details: %s", ein)

    details = propublica.get_nonprofit_details(ein)
    if not details:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {"organization": details.to_dict()}


@app.get("/api/propublica/financials/{ein}")
def get_propublica_financials(ein: str, years: int = 5) -> dict:
    """
    Get structured 5-year financial history directly from ProPublica API.

    This endpoint provides reliable financial data without relying on
    AI parsing. Data includes:
    - Revenue (total revenue)
    - Expenses (total functional expenses)
    - Net Income (calculated: revenue - expenses)
    - Total Assets
    - Net Assets

    Args:
        ein: 9-digit EIN (with or without hyphen)
        years: Number of years of history (default: 5, max: 10)

    Returns:
        Organization info + financial history with formatted values
    """
    logger.info("Fetching ProPublica financials for EIN: %s (%d years)", ein, years)

    # Limit years to prevent excessive API calls
    years = min(years, 10)

    summary = propublica.get_financial_summary(ein)

    if "error" in summary:
        raise HTTPException(status_code=404, detail=summary["error"])

    return summary


class ProviderWithQualityResponse(BaseModel):
    """Response with provider PDF and optional quality report."""
    provider_pdf: str  # base64 encoded
    provider_name: str
    quality_pdf: Optional[str] = None  # base64 encoded if found
    quality_url: Optional[str] = None
    error: Optional[str] = None


@app.get("/api/fetch-provider-with-quality")
def fetch_provider_with_quality(
    url: str = Query(..., min_length=10),
    name: str = Query(..., min_length=1)
) -> ProviderWithQualityResponse:
    """
    Fetch a provider profile PDF and its associated Quality Report.

    The Quality Report URL is extracted from the provider profile PDF.
    Both PDFs are returned as base64-encoded strings.
    """
    logger.info("Fetching provider with quality: %s", name)

    response = ProviderWithQualityResponse(
        provider_pdf="",
        provider_name=name
    )

    # 1. Fetch the provider profile PDF
    try:
        provider_bytes = scraper.fetch_pdf(url)
        response.provider_pdf = base64.b64encode(provider_bytes).decode("utf-8")
        logger.info("Provider PDF fetched: %d bytes", len(provider_bytes))
    except ValueError as exc:
        logger.warning("Provider PDF fetch blocked: %s", str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Provider PDF fetch failed: %s", str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch provider PDF") from exc

    # 2. Extract and fetch Quality Report from provider profile
    try:
        quality_url = scraper.extract_quality_profile_url(provider_bytes)
        if quality_url:
            response.quality_url = quality_url
            logger.info("Extracted quality URL: %s", quality_url)

            if scraper._is_allowed_pdf(quality_url):
                quality_bytes = scraper.fetch_pdf(quality_url)
                response.quality_pdf = base64.b64encode(quality_bytes).decode("utf-8")
                logger.info("Quality report fetched: %d bytes", len(quality_bytes))
            else:
                response.error = "Quality report URL not from allowed domain"
                logger.warning("Quality URL blocked: %s", quality_url)
        else:
            response.error = "No quality report URL found in provider profile"
            logger.debug("No quality URL found for: %s", name)
    except Exception as e:
        logger.error("Error fetching quality report: %s", str(e))
        response.error = f"Quality report fetch error: {str(e)}"

    return response


@app.post("/api/organization/fetch-docs")
def fetch_all_docs(request: FetchDocsRequest) -> FetchDocsResponse:
    """
    Fetch all available documents for an organization:
    - Form 990 from ProPublica
    - Provider Profile from DDS (found by matching org name in city's town PDF)
    - Quality Report from DDS (extracted from provider profile)

    Returns base64-encoded PDFs.
    """
    logger.info("Fetching all docs for EIN: %s", request.ein)

    response = FetchDocsResponse()
    errors = []
    org_name = request.org_name
    city = request.city

    # 1. Fetch Form 990 from ProPublica
    try:
        details = propublica.get_nonprofit_details(request.ein)
        if details:
            response.org_name = details.name
            org_name = org_name or details.name
            city = city or details.city
            # Find the most recent filing that has a PDF URL
            if details.filings:
                for filing in details.filings:
                    if filing.pdf_url:
                        response.form990_year = filing.tax_period
                        break

        pdf_bytes = propublica.fetch_form990_pdf(request.ein)
        if pdf_bytes:
            response.form990 = base64.b64encode(pdf_bytes).decode("utf-8")
            logger.info("Form 990 fetched: %d bytes (year: %s)", len(pdf_bytes), response.form990_year)
        else:
            errors.append("Form 990 not available from ProPublica")
    except Exception as e:
        logger.error("Error fetching Form 990: %s", str(e))
        errors.append(f"Form 990 fetch error: {str(e)}")

    # 2. Find DDS provider URL if not provided
    provider_url = request.provider_url
    if not provider_url and city and org_name:
        logger.info("Searching for DDS provider: %s in %s", org_name, city)
        try:
            # Get providers for this town/city
            providers = scraper.get_providers_for_town(city)
            if providers:
                # Find best match by name
                match = propublica.match_to_dds_provider(org_name, providers)
                if match:
                    provider_url = match["url"]
                    logger.info("Found DDS match: %s -> %s", org_name, match["name"])
                else:
                    errors.append(f"No DDS provider match found in {city}")
            else:
                errors.append(f"No DDS providers found for town: {city}")
        except Exception as e:
            logger.warning("DDS provider search failed: %s", str(e))
            errors.append(f"DDS search error: {str(e)}")

    # 3. Fetch Provider Profile from DDS
    provider_pdf_bytes = None
    if provider_url:
        try:
            provider_pdf_bytes = scraper.fetch_pdf(provider_url)
            if provider_pdf_bytes:
                response.provider_profile = base64.b64encode(provider_pdf_bytes).decode("utf-8")
                logger.info("Provider profile fetched: %d bytes", len(provider_pdf_bytes))
        except Exception as e:
            logger.error("Error fetching provider profile: %s", str(e))
            errors.append(f"Provider profile fetch error: {str(e)}")

    # 4. Extract and fetch Quality Report from provider profile
    if provider_pdf_bytes:
        try:
            quality_url = scraper.extract_quality_profile_url(provider_pdf_bytes)
            if quality_url:
                logger.info("Extracted quality URL: %s", quality_url)
                # Validate URL before fetching
                if scraper._is_allowed_pdf(quality_url):
                    quality_pdf_bytes = scraper.fetch_pdf(quality_url)
                    if quality_pdf_bytes:
                        response.quality_report = base64.b64encode(quality_pdf_bytes).decode("utf-8")
                        logger.info("Quality report fetched: %d bytes", len(quality_pdf_bytes))
                else:
                    logger.warning("Quality URL blocked: %s", quality_url)
                    errors.append("Quality report URL not from allowed domain")
            else:
                errors.append("Quality report URL not found in provider profile")
        except Exception as e:
            logger.error("Error fetching quality report: %s", str(e))
            errors.append(f"Quality report fetch error: {str(e)}")

    response.errors = errors
    return response


