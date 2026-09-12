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

RS-21 (§9.5) adds role resolution on top: once a token is verified, its `sub` is looked up
in `UserProfile` (this app's own table - Supabase's auth.users lives in a schema this app's
Postgres session can't see) to find which of the six roles that account has. A first-time
sign-in with no UserProfile row yet is auto-provisioned - see _resolve_profile for where that
initial role comes from. The very first registry_admin has to be granted by
`scripts/promote_admin.py`, run once from a terminal - nobody can grant themselves the role
that lets them grant roles (see SELF_SERVICE_ROLES below for exactly why that's enforced here,
not just left to the frontend to not offer it as an option).
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import UserProfile

# What Supabase puts in an access token's aud/role claims for a signed-in user.
_EXPECTED_AUDIENCE = "authenticated"
LOCAL_DEV_AUDITOR = "local-dev@recshield"
DEFAULT_ROLE = "auditor"
ROLES = ("registry_admin", "regulator", "auditor", "plant_operator", "buyer")
# RS-22: roles a signup form may request for itself via Supabase user_metadata. registry_admin
# is deliberately excluded - user_metadata is client-supplied data (anyone can call Supabase's
# own signUp() with arbitrary options.data), so treat a requested "registry_admin" the same as
# an attacker's forged claim, not a real request: fall back to DEFAULT_ROLE instead of honoring
# it. Granting registry_admin is only ever done by an existing admin or promote_admin.py.
SELF_SERVICE_ROLES = ("regulator", "auditor", "plant_operator", "buyer")

_jwks_client: jwt.PyJWKClient | None = None


@dataclass
class Auditor:
    """Kept the name from RS-16 rather than renaming to "Principal" everywhere it's already
    imported - it's a misnomer for a buyer or plant_operator now, but a rename touches every
    endpoint file for no behavior change. Read it as "the authenticated caller"."""
    id: str
    email: str
    role: str = DEFAULT_ROLE
    plant_id: str | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _decode(token: str) -> dict:
    try:
        # leeway: tolerates ordinary clock drift between this machine and Supabase's servers
        # when checking iat/exp/nbf - without it, PyJWT rejects an otherwise-valid token as
        # "not yet valid (iat)" any time the local system clock is even a few seconds behind
        # real time (common on a machine whose clock hasn't synced recently). This doesn't fix
        # a badly wrong clock (minutes/hours off) - only a corrected system clock does that.
        if settings.SUPABASE_JWT_SECRET:
            return jwt.decode(
                token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"],
                audience=_EXPECTED_AUDIENCE, leeway=60,
            )

        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token, signing_key.key, algorithms=["RS256", "ES256"],
            audience=_EXPECTED_AUDIENCE, leeway=60,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired - please sign in again.")
    except jwt.PyJWKClientError as exc:
        raise HTTPException(status_code=401, detail=f"Could not verify token signature: {exc}")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid session token: {exc}")


def _resolve_profile(db: Session, user_id: str, email: str, requested_role: str | None, requested_plant_id: str | None) -> UserProfile:
    """Look up this user's role/plant, auto-provisioning a row on first sign-in.

    RS-22: `requested_role`/`requested_plant_id` come from the signup form's choice, carried in
    the JWT's own user_metadata (see AuthContext.jsx's signUp call) - Supabase embeds whatever
    a client passed to signUp(options.data) into every token that account gets afterward. That
    makes this data client-controlled, same trust level as a query parameter: only honored
    through the SELF_SERVICE_ROLES allowlist, and only read here, at the moment this row is
    first created. Once a UserProfile row exists, later sign-ins never re-read this claim again
    - an admin's assignment (or the account's own initial choice) is what sticks, not whatever
    metadata a subsequent token happens to carry.
    """
    profile = db.get(UserProfile, user_id)
    if profile is None:
        role = requested_role if requested_role in SELF_SERVICE_ROLES else DEFAULT_ROLE
        plant_id = requested_plant_id if role == "plant_operator" else None
        profile = UserProfile(id=user_id, email=email, role=role, plant_id=plant_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    elif profile.email != email:
        # Emails can change on the Supabase side; keep this table from drifting stale.
        profile.email = email
        db.commit()
    return profile


def get_current_auditor(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> Auditor:
    """FastAPI dependency for every authenticated route. Returns the caller's identity *and*
    role (RS-21) - endpoints that need to restrict by role wrap this with `require_role(...)`
    rather than checking `.role` themselves, so the allowed-roles list for a route is visible
    at the route definition, not buried in a service function."""
    if not settings.SUPABASE_JWT_SECRET and not settings.SUPABASE_URL:
        # Local dev / pytest with Supabase unconfigured: full access, as before RBAC existed -
        # there's no real user to scope down to, and every existing test/demo run assumes this.
        return Auditor(id="local-dev", email=LOCAL_DEV_AUDITOR, role="registry_admin")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required: missing Authorization header.")

    claims = _decode(authorization.removeprefix("Bearer ").strip())
    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token has no email claim.")
    # RS-22: Supabase puts whatever was passed to signUp(options.data) here - the role/plant a
    # signup form asked for. Only ever consulted on first sign-in; see _resolve_profile.
    metadata = claims.get("user_metadata") or {}
    profile = _resolve_profile(db, claims["sub"], email, metadata.get("role"), metadata.get("plant_id"))
    return Auditor(id=claims["sub"], email=email, role=profile.role, plant_id=profile.plant_id)


def require_role(*roles: str):
    """Dependency factory: `Depends(require_role("registry_admin", "auditor"))` on a route
    gates it to just those roles, 403ing everyone else. Keeping the allowed set as an argument
    at the route means `grep require_role` in a route file shows exactly who can call it,
    rather than that logic living inside a service function several layers away."""
    def dependency(auditor: Auditor = Depends(get_current_auditor)) -> Auditor:
        if auditor.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of: {', '.join(roles)}. Your role is '{auditor.role}'.",
            )
        return auditor
    return dependency
