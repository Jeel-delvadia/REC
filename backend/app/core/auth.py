"""RS-16: verifies the Supabase Auth JWT an auditor's browser sends on write requests.

Supabase signs its access tokens with HS256 using the project's JWT secret (Project Settings
-> API -> JWT Settings). Verifying it here is just decode-and-check - no network call, no
Supabase SDK needed server-side.

Soft-gated on purpose: with SUPABASE_JWT_SECRET unset (local dev, pytest, a demo before Supabase
is wired up), every auditor route falls back to a fixed "local-dev" identity instead of 401ing.
Once the secret is set, a missing or invalid token is rejected - there is no in-between.
"""
from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException

from app.core.config import settings

# What Supabase puts in an access token's aud/role claims for a signed-in user.
_EXPECTED_AUDIENCE = "authenticated"
LOCAL_DEV_AUDITOR = "local-dev@recshield"


@dataclass
class Auditor:
    id: str
    email: str


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience=_EXPECTED_AUDIENCE)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired - please sign in again.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {exc}")


def get_current_auditor(authorization: str | None = Header(default=None)) -> Auditor:
    """FastAPI dependency for every auditor-only route (actions, verify, ingest, create_rec)."""
    if not settings.SUPABASE_JWT_SECRET:
        return Auditor(id="local-dev", email=LOCAL_DEV_AUDITOR)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required: missing Authorization header.")

    claims = _decode(authorization.removeprefix("Bearer ").strip())
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token has no email claim.")
    return Auditor(id=claims["sub"], email=email)
