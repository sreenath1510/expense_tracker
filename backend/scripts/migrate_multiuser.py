"""
One-shot migration: single-tenant DB -> multi-user.

Assigns all existing rows to the admin user by adding a `user_id` column to
every data table (rebuilding the four tables whose UNIQUE constraints become
per-user). Backs up the SQLite file first. Idempotent: re-running is a no-op
once `blocks.user_id` exists.

    python -m scripts.migrate_multiuser
"""

import shutil
from datetime import datetime

from sqlalchemy import select, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password

# Tables that only need a user_id column added (no constraint change).
ALTER_ONLY = ["line_items", "transactions", "income_entries", "budgets"]

# Tables rebuilt to add user_id AND change a global UNIQUE to a per-user one.
REBUILD_DDL = {
    "blocks": """
        CREATE TABLE blocks_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            UNIQUE (user_id, name),
            CHECK (type IN ('EXPENSE', 'INVESTMENT'))
        )
    """,
    "payment_sources": """
        CREATE TABLE payment_sources_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            UNIQUE (user_id, name)
        )
    """,
    "income_sources": """
        CREATE TABLE income_sources_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            UNIQUE (user_id, name)
        )
    """,
    "monthly_remarks": """
        CREATE TABLE monthly_remarks_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            body TEXT NOT NULL,
            updated_at DATETIME,
            UNIQUE (user_id, year, month),
            CHECK (month BETWEEN 1 AND 12)
        )
    """,
}

REBUILD_COLS = {
    "blocks": "id, name, type, sort_order, created_at",
    "payment_sources": "id, name, sort_order, created_at",
    "income_sources": "id, name, sort_order, created_at",
    "monthly_remarks": "id, year, month, body, updated_at",
}


def _has_column(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).all()
    return any(r[1] == column for r in rows)


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"), {"n": table}
    ).first()
    return row is not None


def main() -> None:
    Base.metadata.create_all(bind=engine)  # ensure users/budgets tables exist

    # Ensure an admin user exists; existing data is assigned to it.
    db = SessionLocal()
    try:
        admin = db.scalar(
            select(User).where(User.username == settings.default_admin_username)
        )
        if admin is None:
            admin = User(
                username=settings.default_admin_username,
                password_hash=hash_password(settings.default_admin_password),
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        admin_id = admin.id
    finally:
        db.close()

    url = settings.database_url
    if url.startswith("sqlite") and "://" in url:
        path = url.split("///")[-1]
        if path and path != ":memory:":
            backup = f"{path}.bak-{datetime.now():%Y%m%d%H%M%S}"
            shutil.copyfile(path, backup)
            print(f"Backed up database to {backup}")

    with engine.begin() as conn:
        if _has_column(conn, "blocks", "user_id"):
            print("Already migrated (blocks.user_id exists). Nothing to do.")
            return

        conn.execute(text("PRAGMA foreign_keys=OFF"))

        for table, ddl in REBUILD_DDL.items():
            if not _table_exists(conn, table):
                continue
            print(f"Rebuilding {table} with user_id + per-user uniqueness...")
            conn.execute(text(ddl))
            cols = REBUILD_COLS[table]
            conn.execute(
                text(
                    f"INSERT INTO {table}_new (user_id, {cols}) "
                    f"SELECT {admin_id}, {cols} FROM {table}"
                )
            )
            conn.execute(text(f"DROP TABLE {table}"))
            conn.execute(text(f"ALTER TABLE {table}_new RENAME TO {table}"))

        for table in ALTER_ONLY:
            if not _table_exists(conn, table):
                continue
            if _has_column(conn, table, "user_id"):
                continue
            print(f"Adding user_id to {table}...")
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))
            conn.execute(text(f"UPDATE {table} SET user_id = {admin_id}"))

        conn.execute(text("PRAGMA foreign_keys=ON"))

    print(f"Migration complete. All existing data now belongs to '{settings.default_admin_username}'.")


if __name__ == "__main__":
    main()
