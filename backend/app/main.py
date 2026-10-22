"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import config
from .db import engine
from .routers import auth, complaints, geo, tickets

app = FastAPI(
    title="CivicSense API",
    description="AI powered civic intelligence and issue resolution platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(geo.router)
app.include_router(tickets.router)


@app.get("/health")
def health() -> dict:
    """Liveness plus a real database check.

    A green health response has to mean the app can actually serve traffic, so
    the database is pinged here instead of trusting that the process is up.
    """
    database = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # the database may be down
        database = f"unavailable: {exc.__class__.__name__}"
    status = "ok" if database == "ok" else "degraded"
    return {
        "status": status,
        "database": database,
        "model_version": config.MODEL_VERSION,
    }
