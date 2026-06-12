"""
SQLAlchemy 2.0 engine + session factory.

The `get_db` generator is the FastAPI dependency injected into every route
that touches the DB — it ensures sessions are closed even if the handler
raises. Keep all session lifecycle here so routers stay declarative.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# `check_same_thread=False` is only needed for SQLite + multi-threaded servers
# (uvicorn workers). It's harmless on Postgres because the option is ignored.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# pool_pre_ping recycles connections that a serverless platform / Postgres
# (Neon) may have closed between invocations, so requests don't hit a dead
# socket after the function goes idle. Harmless for SQLite.
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    """Single declarative base for every model. Imported by models.py."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a session, always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
