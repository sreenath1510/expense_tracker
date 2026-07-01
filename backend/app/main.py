"""
FastAPI application entry.

This file does one thing: wire everything together. The CORS middleware
reads its allowed origins from settings so the prod frontend URL (e.g.
your-app.vercel.app) is configurable without code changes.

All routes are mounted under /api so they sit cleanly behind the Vite
dev proxy and any future production reverse proxy.
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    auth,
    backup,
    blocks,
    budgets,
    income_sources,
    line_items,
    matrix,
    payment_sources,
    remarks,
    transactions,
    upload,
)
from app.security import get_current_user

app = FastAPI(
    title="Ledger API",
    description="Local-first personal finance backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["meta"])
@app.get("/api/healthz", tags=["meta"])
def healthz() -> dict[str, str]:
    # /api/healthz is the one reachable on Vercel (only /api/* hits the function);
    # it does no DB work, so it isolates "function is up" from "DB is configured".
    return {"status": "ok"}


# Auth routes are public (login/register issue the token; /me validates it).
app.include_router(auth.router, prefix="/api")

# Every other router is mounted under /api *and* behind the auth gate, so the
# whole application requires a valid token. The frontend's existing Vite proxy
# config ("/api" → http://localhost:8000) needs no changes.
for router in (
    blocks.router,
    line_items.router,
    payment_sources.router,
    income_sources.router,
    transactions.router,
    matrix.router,
    upload.router,
    remarks.router,
    budgets.router,
    backup.router,
):
    app.include_router(router, prefix="/api", dependencies=[Depends(get_current_user)])
