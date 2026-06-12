"""
Create tables and seed the bootstrap admin user (with their default
categories). Idempotent: existing data is left alone.

    python -m scripts.init_db

For an EXISTING single-tenant database created before multi-user support,
run `python -m scripts.migrate_multiuser` first to assign existing data to
the admin account.
"""

from sqlalchemy import select

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Block, User
from app.seed import seed_user_defaults
from app.security import hash_password


def main() -> None:
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = db.scalar(
            select(User).where(User.username == settings.default_admin_username)
        )
        if admin is None:
            print("Seeding default admin user...")
            admin = User(
                username=settings.default_admin_username,
                password_hash=hash_password(settings.default_admin_password),
            )
            db.add(admin)
            db.flush()
            print(
                f"  -> login with username '{settings.default_admin_username}' / "
                f"password '{settings.default_admin_password}' "
                "(change these via env vars for production)."
            )

        # Seed default categories for the admin if they have none yet.
        if db.scalar(select(Block.id).where(Block.user_id == admin.id).limit(1)) is None:
            print("Seeding default categories for admin...")
            seed_user_defaults(db, admin.id)

        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
