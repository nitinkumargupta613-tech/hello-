"""Turning what a person types into a point on the map.

The campus gazetteer answers first: a local name such as "main gate 2" is
resolved instantly and works offline. Anything the gazetteer does not know
falls through to OpenStreetMap's Nominatim service, and if that is not
reachable the caller gets a clear "not found" instead of a hang.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any

import requests

from .. import settings
from .geo import haversine_m

NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "CivicSense/0.1 (campus civic issue reporting)"
TIMEOUT = 6

# Nominatim asks for at most one request per second.
_throttle_lock = threading.Lock()
_last_request = 0.0


def _throttle() -> None:
    global _last_request
    with _throttle_lock:
        wait = 1.1 - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _score(place: dict, query: str) -> float:
    """How well a campus place matches the query (higher is better)."""
    normalised = _normalise(query)
    best = 0.0
    for alias in [place["name"], *place.get("aliases", [])]:
        candidate = _normalise(alias)
        if candidate == normalised:
            best = max(best, 1.0)
        elif normalised and (candidate.startswith(normalised) or normalised.startswith(candidate)):
            best = max(best, 0.8)
        elif normalised and normalised in candidate:
            best = max(best, 0.6)
        elif normalised and candidate in normalised:
            best = max(best, 0.5)
    return best


def campus_matches(query: str) -> list[dict]:
    """Campus places that match the query, best first."""
    scored = [
        (score, place)
        for place in settings.CAMPUS_PLACES
        if (score := _score(place, query)) > 0
    ]
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "label": place["name"],
            "lat": place["lat"],
            "lng": place["lng"],
            "source": "campus",
        }
        for score, place in scored
    ]


def nearest_campus_place(lat: float, lng: float) -> dict | None:
    """The closest named campus place to a point."""
    best: tuple[float, dict] | None = None
    for place in settings.CAMPUS_PLACES:
        distance = haversine_m(lat, lng, place["lat"], place["lng"])
        if best is None or distance < best[0]:
            best = (distance, place)
    if best is None:
        return None
    return {
        "label": best[1]["name"],
        "lat": best[1]["lat"],
        "lng": best[1]["lng"],
        "distance_m": round(best[0], 1),
        "source": "campus",
    }


def _nominatim_search(query: str) -> list[dict]:
    try:
        _throttle()
        response = requests.get(
            NOMINATIM_SEARCH,
            params={
                "q": query,
                "format": "jsonv2",
                "limit": 5,
                "addressdetails": 1,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        payload: list[dict[str, Any]] = response.json()
    except Exception:
        return []

    results: list[dict] = []
    for item in payload:
        try:
            results.append(
                {
                    "label": item.get("display_name", query),
                    "lat": float(item["lat"]),
                    "lng": float(item["lon"]),
                    "source": "openstreetmap",
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return results


def _nominatim_reverse(lat: float, lng: float) -> dict | None:
    try:
        _throttle()
        response = requests.get(
            NOMINATIM_REVERSE,
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "zoom": 18,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    label = payload.get("display_name")
    if not label:
        return None
    return {
        "label": label,
        "lat": lat,
        "lng": lng,
        "distance_m": 0,
        "source": "openstreetmap",
    }


def search_place(query: str, *, allow_network: bool = True) -> dict:
    """Resolve free text into a point.

    Returns the best match plus the alternatives, so the form can offer a
    short list instead of guessing silently.
    """
    query = query.strip()
    if not query:
        return {"found": False, "reason": "empty", "candidates": []}

    local = campus_matches(query)
    if local:
        return {"found": True, "candidates": local, "source": "campus"}

    remote = _nominatim_search(query) if allow_network else []
    if remote:
        return {"found": True, "candidates": remote, "source": "openstreetmap"}

    return {
        "found": False,
        "reason": "not found",
        "candidates": [],
        "hint": (
            "Try a campus place such as Main Gate 2, Library Crossing or "
            "Hostel H3 Block, or pick a point on the map."
        ),
    }


def reverse_place(lat: float, lng: float, *, allow_network: bool = True) -> dict:
    """Describe a point in words."""
    nearest = nearest_campus_place(lat, lng)
    if nearest and nearest["distance_m"] <= 150:
        nearest["label"] = f"Near {nearest['label']}"
        return nearest

    if allow_network:
        remote = _nominatim_reverse(lat, lng)
        if remote:
            return remote

    if nearest:
        return nearest
    return {
        "label": f"{lat:.5f}, {lng:.5f}",
        "lat": lat,
        "lng": lng,
        "distance_m": None,
        "source": "coordinates",
    }
