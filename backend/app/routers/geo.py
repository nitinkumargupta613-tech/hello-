"""Location lookup endpoints used by the report form."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..services import geocoding

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/search")
def search(
    q: str = Query(min_length=1, max_length=120),
    offline: bool = Query(default=False),
) -> dict:
    """Resolve a place name into a point on the map."""
    return geocoding.search_place(q, allow_network=not offline)


@router.get("/reverse")
def reverse(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    offline: bool = Query(default=False),
) -> dict:
    """Describe a point in words, used after the browser shares a position."""
    return geocoding.reverse_place(lat, lng, allow_network=not offline)
