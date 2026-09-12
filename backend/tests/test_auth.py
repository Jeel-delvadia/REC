"""RS-16: exercises get_current_auditor against locally-signed tokens shaped like a real
Supabase access token - no live Supabase project needed, since HS256 verification is pure
crypto once we know the secret. Restores the module's cached settings after each test so
these don't leak into other tests that import app.core.config.settings.
"""
import time

import jwt
import pytest
from fastapi import HTTPException

from app.core import auth
from app.core.config import settings

TEST_SECRET = "unit-test-secret-do-not-use-in-production"


def _token(secret=TEST_SECRET, **overrides):
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "auditor@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def with_secret():
    """Auth is soft-gated off by default (settings.SUPABASE_JWT_SECRET == ""); turn it on."""
    original = settings.SUPABASE_JWT_SECRET
    settings.SUPABASE_JWT_SECRET = TEST_SECRET
    yield
    settings.SUPABASE_JWT_SECRET = original


def test_no_secret_configured_falls_back_to_local_dev():
    assert settings.SUPABASE_JWT_SECRET == ""  # the default - nothing else has set it
    result = auth.get_current_auditor(authorization=None)
    assert result.email == auth.LOCAL_DEV_AUDITOR


def test_valid_token_is_accepted(with_secret):
    result = auth.get_current_auditor(authorization=f"Bearer {_token()}")
    assert result.email == "auditor@example.com"
    assert result.id == "11111111-1111-1111-1111-111111111111"


def test_missing_header_is_rejected(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=None)
    assert exc.value.status_code == 401


def test_missing_bearer_prefix_is_rejected(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=_token())  # no "Bearer " prefix
    assert exc.value.status_code == 401


def test_wrong_secret_is_rejected(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=f"Bearer {_token(secret='someone-elses-secret-of-a-similar-length')}")
    assert exc.value.status_code == 401


def test_expired_token_is_rejected(with_secret):
    stale = _token(exp=int(time.time()) - 60)
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=f"Bearer {stale}")
    assert exc.value.status_code == 401
    assert "expired" in exc.value.detail.lower()


def test_wrong_audience_is_rejected(with_secret):
    # e.g. a service-role key or a token from a different Supabase project
    with pytest.raises(HTTPException):
        auth.get_current_auditor(authorization=f"Bearer {_token(aud='some-other-audience')}")


def test_token_without_email_claim_is_rejected(with_secret):
    stripped = jwt.encode(
        {"sub": "x", "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 3600},
        TEST_SECRET, algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=f"Bearer {stripped}")
    assert "email" in exc.value.detail.lower()
