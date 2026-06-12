"""
Authentication primitives: password hashing, JWT issue/verify, and the
`get_current_user` FastAPI dependency that protects routes.

Deliberately dependency-light: password hashing uses the stdlib PBKDF2-HMAC
(no native bcrypt build needed on Windows), and tokens use PyJWT (pure
Python). Both are industry-standard and round-trip cleanly to Postgres in
production with no code changes.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

# --- Password hashing -------------------------------------------------------
# Stored format: "pbkdf2_sha256$<iterations>$<b64 salt>$<b64 hash>".
_ALGORITHM = "pbkdf2_sha256"
_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return (
        f"{_ALGORITHM}${_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_s, salt_b64, hash_b64 = stored.split("$")
        if algorithm != _ALGORITHM:
            return False
        iterations = int(iterations_s)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        # Constant-time comparison guards against timing attacks.
        return hmac.compare_digest(dk, expected)
    except (ValueError, TypeError):
        return False


# --- JWT --------------------------------------------------------------------
def create_access_token(subject: str) -> str:
    """Sign a short-lived HS256 token whose `sub` claim is the username."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


# --- Current-user dependency ------------------------------------------------
# auto_error=True makes a missing/garbled Authorization header a clean 403.
_bearer = HTTPBearer(auto_error=True)

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Decode the bearer token and resolve it to a live User row.

    Mounted as a router-level dependency so every protected endpoint shares
    one gate. Raises 401 on any failure (bad signature, expired, unknown user).
    """
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=["HS256"]
        )
        username = payload.get("sub")
        if not username:
            raise _credentials_error
    except jwt.PyJWTError as exc:
        raise _credentials_error from exc

    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise _credentials_error
    return user
