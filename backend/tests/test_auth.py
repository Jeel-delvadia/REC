"""RS-16: exercises get_current_auditor against locally-signed tokens shaped like a real
Supabase access token - no live Supabase project or network access needed, for either
verification path. HS256 is pure crypto once we know the secret; the JWKS/asymmetric path is
tested against a real RSA keypair generated in-test, with the network fetch itself mocked out
(auth._get_jwks_client monkeypatched to a stub whose get_signing_key_from_jwt returns our key
directly) - PyJWT's own signature verification still runs for real against it.
Restores the module's cached settings/client after each test so these don't leak elsewhere.
"""
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core import auth
from app.core.config import settings

TEST_SECRET = "unit-test-secret-do-not-use-in-production"


def _new_rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


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
def with_secret(monkeypatch):
    """Turn on the HS256 path, regardless of whatever the environment's own .env has set -
    monkeypatch restores the real value after the test either way."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


@pytest.fixture
def with_jwks(monkeypatch):
    """Turns on the JWKS/asymmetric path, backed by a real RSA keypair generated fresh for
    this test - no network call, since _get_jwks_client is replaced with a stub returning our
    own public key directly. PyJWT still does real signature verification against it. Forces
    SUPABASE_JWT_SECRET empty too, since _decode() checks it first - without this, a real
    .env that sets both would silently skip the JWKS path this fixture means to exercise."""
    private_key = _new_rsa_key()
    public_key = private_key.public_key()

    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://unit-test.supabase.co")
    monkeypatch.setattr(auth, "_jwks_client", None)
    monkeypatch.setattr(
        auth, "_get_jwks_client",
        lambda: SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=public_key)),
    )
    return private_key


def _rsa_token(private_key, **overrides):
    claims = {
        "sub": "22222222-2222-2222-2222-222222222222",
        "email": "auditor@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(claims, private_key, algorithm="RS256")


def test_neither_configured_falls_back_to_local_dev(monkeypatch):
    # Force the soft-gated-off state rather than assuming the environment starts empty - a
    # developer's own .env legitimately sets these once Supabase is configured, and this test
    # broke exactly that way the first time it ran against a real backend/.env (found live).
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    result = auth.get_current_auditor(authorization=None)
    assert result.email == auth.LOCAL_DEV_AUDITOR


def test_jwks_path_accepts_a_correctly_signed_token(with_jwks):
    result = auth.get_current_auditor(authorization=f"Bearer {_rsa_token(with_jwks)}")
    assert result.email == "auditor@example.com"
    assert result.id == "22222222-2222-2222-2222-222222222222"


def test_jwks_path_rejects_a_token_signed_by_a_different_key(with_jwks):
    other_key = _new_rsa_key()  # a token from an attacker's own keypair, not the project's
    with pytest.raises(HTTPException) as exc:
        auth.get_current_auditor(authorization=f"Bearer {_rsa_token(other_key)}")
    assert exc.value.status_code == 401


def test_jwt_secret_takes_priority_over_jwks_when_both_are_set(with_jwks, monkeypatch):
    # HS256 is checked first (settings.SUPABASE_JWT_SECRET) - a JWKS-signed token must not
    # slip through if a secret is also configured, since _decode() would try HS256 on it.
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    with pytest.raises(HTTPException):
        auth.get_current_auditor(authorization=f"Bearer {_rsa_token(with_jwks)}")


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
