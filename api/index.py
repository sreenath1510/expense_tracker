"""Vercel serverless entry for the FastAPI backend.

Vercel's @vercel/python runtime serves the ASGI ``app`` exposed here. The
backend package lives in ../backend, so we put it on sys.path before importing.
Every API route is already prefixed with ``/api`` and vercel.json routes
``/api/*`` to this function, so FastAPI matches the original request path.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402  (sys.path setup must run first)

# Vercel's Python runtime auto-detects the ASGI `app` object.
__all__ = ["app"]
