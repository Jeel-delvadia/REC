"""RS-16: verifies the Supabase Auth JWT an auditor's browser sends on write requests.

Two ways to verify, either is enough:
- SUPABASE_JWT_SECRET set: legacy HS256 shared secret, decode-and-check, no network call.
- SUPABASE_URL set (no secret): fetch the project's public JWKS and verify the asymmetric
  signature (RS256/ES256) - works regardless of which signing key type the project uses,
  which newer Supabase projects (issued sb_publishable_.../sb_secret_... keys, not a legacy
  anon/service_role pair) may rely on exclusively. Keys are cached by PyJWKClient and only
  refetched when a token names a kid it hasn't seen.

Soft-gated on purpose: with neither set (local dev, pytest, a demo before Supabase is wired
up), every auditor route falls back to a fixed "local-dev" identity instead of 401ing. Once
either is set, a missing or invalid token is rejected - there is no in-between.
"""
from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException

from app.core.config import settings

# What Supabase puts in an access token's aud/role claims for a signed-in user.
_EXPECTED_AUDIENCE = "authenticated"
LOCAL_DEV_AUDITOR = "local-dev@recshield"

_jwks_client: jwt.PyJWKClient | None = None


@dataclass
class Auditor:
    id: str
    email: str


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _decode(token: str) -> dict:
    try:
        if settings.SUPABASE_JWT_SECRET:
            return jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience=_EXPECTED_AUDIENCE)

        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(token, signing_key.key, algorithms=["RS256", "ES256"], audience=_EXPECTED_AUDIENCE)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired - please sign in again.")
    except jwt.PyJWKClientError as exc:
        raise HTTPException(status_code=401, detail=f"Could not verify token signature: {exc}")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {exc}")


def get_current_auditor(authorization: str | None = Header(default=None)) -> Auditor:
    """FastAPI dependency for every auditor-only route (actions, verify, ingest, create_rec)."""
    if not settings.SUPABASE_JWT_SECRET and not settings.SUPABASE_URL:
        return Auditor(id="local-dev", email=LOCAL_DEV_AUDITOR)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required: missing Authorization header.")

    claims = _decode(authorization.removeprefix("Bearer ").strip())
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token has no email claim.")
    return Auditor(id=claims["sub"], email=email)
