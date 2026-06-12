"""
Settings loaded from environment / .env file.

Centralizing config here means the only thing that changes between local dev
and hosted deployment is environment variables — the code stays identical.
SQLite locally; flip DATABASE_URL to a Postgres URL on Railway/Fly/Render
in production and nothing else needs to change.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database: SQLite for local dev, Postgres for prod (same SQLAlchemy code).
    database_url: str = "sqlite:///./finance.db"

    # CORS: comma-separated list. Vite dev server runs on 5173.
    cors_origins: str = "http://localhost:5173"

    # --- Auth ---------------------------------------------------------------
    # SECRET_KEY signs the JWTs. The default is fine for local dev; set a long
    # random value in the environment for any hosted deployment.
    secret_key: str = "dev-secret-change-me-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7  # one week

    # Credentials for the user `scripts.init_db` seeds on a fresh database.
    default_admin_username: str = "admin"
    default_admin_password: str = "ledger"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
