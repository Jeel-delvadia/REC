"""RS-21 (§9.5): row-level scoping for plant_operator ("own plant only") and buyer ("own
held RECs only"), plus user_service's role-assignment validation. Uses an in-memory SQLite DB
with a couple of plants/RECs, not the live Supabase instance - these are pure data-access
rules, no network or auth-token machinery needed to exercise them.
"""
from dataclasses import dataclass
from datetime import date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.database import Base, utcnow
from app.models import Plant, Rec, UserProfile
from app.services import NotFoundError, dashboard_service, rec_service, user_service


@dataclass
class FakeViewer:
    id: str
    role: str
    plant_id: str | None = None


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    session.add_all([
        Plant(id="PLT-001", name="Alpha Solar", owner="Alpha Co", latitude=1.0, longitude=1.0, capacity_kw=1000, technology="solar"),
        Plant(id="PLT-002", name="Beta Solar", owner="Beta Co", latitude=2.0, longitude=2.0, capacity_kw=2000, technology="solar"),
    ])
    session.add_all([
        Rec(
            id="REC-A1", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=10, issued_at=utcnow(), holder="Buyer One Inc", status="pending",
            buyer_user_id="buyer-1",
        ),
        Rec(
            id="REC-B1", plant_id="PLT-002", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=20, issued_at=utcnow(), holder="Buyer Two Inc", status="pending",
            buyer_user_id="buyer-2",
        ),
    ])
    session.commit()
    yield session
    session.close()


# --- rec_service.search scoping ----------------------------------------------------------

def test_unscoped_roles_see_every_rec(db):
    for role in ("registry_admin", "regulator", "auditor"):
        result = rec_service.search(db, viewer=FakeViewer(id="x", role=role))
        assert {r["id"] for r in result["items"]} == {"REC-A1", "REC-B1"}


def test_no_viewer_sees_every_rec(db):
    # Local-dev / unauthenticated callers - same as before RBAC existed.
    result = rec_service.search(db, viewer=None)
    assert {r["id"] for r in result["items"]} == {"REC-A1", "REC-B1"}


def test_plant_operator_sees_only_their_plant(db):
    result = rec_service.search(db, viewer=FakeViewer(id="op-1", role="plant_operator", plant_id="PLT-001"))
    assert {r["id"] for r in result["items"]} == {"REC-A1"}


def test_buyer_sees_only_their_own_recs(db):
    result = rec_service.search(db, viewer=FakeViewer(id="buyer-2", role="buyer"))
    assert {r["id"] for r in result["items"]} == {"REC-B1"}


def test_buyer_with_no_recs_sees_nothing(db):
    result = rec_service.search(db, viewer=FakeViewer(id="buyer-nobody", role="buyer"))
    assert result["items"] == []


def test_unrecognised_role_sees_nothing_rather_than_everything(db):
    # A safe failure mode: an unmapped/future role should never silently fall through to
    # "everyone sees everything."
    result = rec_service.search(db, viewer=FakeViewer(id="x", role="mystery_role"))
    assert result["items"] == []


# --- rec_service.get_detail scoping -------------------------------------------------------

def test_get_detail_visible_within_scope(db):
    detail = rec_service.get_detail(db, "REC-A1", viewer=FakeViewer(id="op-1", role="plant_operator", plant_id="PLT-001"))
    assert detail["id"] == "REC-A1"


def test_get_detail_raises_not_found_when_out_of_scope(db):
    # Not 403 - a scoped-out caller shouldn't learn the REC exists at all.
    with pytest.raises(NotFoundError):
        rec_service.get_detail(db, "REC-B1", viewer=FakeViewer(id="op-1", role="plant_operator", plant_id="PLT-001"))


def test_buyer_cannot_see_someone_elses_rec_detail(db):
    with pytest.raises(NotFoundError):
        rec_service.get_detail(db, "REC-A1", viewer=FakeViewer(id="buyer-2", role="buyer"))


# --- dashboard_service.summary scoping ----------------------------------------------------

def test_dashboard_totals_scoped_to_plant_operator(db):
    result = dashboard_service.summary(db, viewer=FakeViewer(id="op-1", role="plant_operator", plant_id="PLT-001"))
    assert result["stats"]["total_recs"] == 1


def test_dashboard_totals_unscoped_for_auditor(db):
    result = dashboard_service.summary(db, viewer=FakeViewer(id="x", role="auditor"))
    assert result["stats"]["total_recs"] == 2


# --- user_service.set_role validation ------------------------------------------------------

def test_set_role_rejects_unknown_role(db):
    db.add(UserProfile(id="u1", email="a@example.com", role="auditor"))
    db.commit()
    with pytest.raises(ValueError):
        user_service.set_role(db, "u1", "superuser", None)


def test_set_role_requires_plant_id_for_plant_operator(db):
    db.add(UserProfile(id="u1", email="a@example.com", role="auditor"))
    db.commit()
    with pytest.raises(ValueError):
        user_service.set_role(db, "u1", "plant_operator", None)


def test_set_role_raises_not_found_for_unknown_user(db):
    with pytest.raises(NotFoundError):
        user_service.set_role(db, "does-not-exist", "registry_admin", None)


def test_set_role_succeeds_and_clears_plant_id_for_non_operator_roles(db):
    db.add(UserProfile(id="u1", email="a@example.com", role="plant_operator", plant_id="PLT-001"))
    db.commit()
    updated = user_service.set_role(db, "u1", "regulator", None)
    assert updated.role == "regulator"
    assert updated.plant_id is None


# --- rec_service.assign_buyer (RS-23) -------------------------------------------------------


def test_assign_buyer_links_rec_and_it_becomes_visible_to_them(db):
    db.add(UserProfile(id="buyer-99", email="newbuyer@example.com", role="buyer"))
    db.commit()
    detail = rec_service.assign_buyer(db, "REC-A1", "newbuyer@example.com")
    assert detail["buyer_email"] == "newbuyer@example.com"

    result = rec_service.search(db, viewer=FakeViewer(id="buyer-99", role="buyer"))
    assert {r["id"] for r in result["items"]} == {"REC-A1"}


def test_assign_buyer_rejects_unknown_email(db):
    with pytest.raises(NotFoundError):
        rec_service.assign_buyer(db, "REC-A1", "nobody@example.com")


def test_assign_buyer_rejects_non_buyer_account(db):
    db.add(UserProfile(id="reg-1", email="regulator@example.com", role="regulator"))
    db.commit()
    with pytest.raises(ValueError):
        rec_service.assign_buyer(db, "REC-A1", "regulator@example.com")
