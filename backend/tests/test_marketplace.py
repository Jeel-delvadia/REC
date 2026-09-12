"""RS-24: buyer-initiated purchase requests, gated behind auditor/admin approval. Uses an
in-memory SQLite DB with a couple of plants/RECs - no live Supabase needed, these are pure
data-access and state-transition rules.
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.database import Base, utcnow
from app.models import Plant, Rec
from app.schemas.purchase_request import MarketplaceListingOut
from app.services import NotFoundError, marketplace_service


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    session.add(Plant(id="PLT-001", name="Alpha Solar", owner="Alpha Co", latitude=1.0, longitude=1.0, capacity_kw=1000, technology="solar"))
    session.add_all([
        Rec(
            id="REC-AVAIL", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=10, issued_at=utcnow(), holder="Original Holder Co", status="approved",
        ),
        Rec(
            id="REC-CLAIMED", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=10, issued_at=utcnow(), holder="Someone Else Co", status="approved",
            buyer_user_id="already-a-buyer",
        ),
        Rec(
            id="REC-REJECTED", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=10, issued_at=utcnow(), holder="Flagged Co", status="rejected",
        ),
        Rec(
            id="REC-RETIRED", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 5),
            energy_mwh=10, issued_at=utcnow(), holder="Retired Co", status="approved",
            certificate_status="retired",
        ),
    ])
    session.commit()
    yield session
    session.close()


# --- listing --------------------------------------------------------------------------------

def test_marketplace_lists_only_unclaimed_eligible_recs(db):
    listing = marketplace_service.list_marketplace(db)
    assert {r["id"] for r in listing} == {"REC-AVAIL"}
    assert listing[0]["plant_name"] == "Alpha Solar"


def test_marketplace_listing_matches_its_response_schema(db):
    # Guards against exactly the bug this caught live: returning raw ORM rows whose fields
    # don't line up with what the endpoint's response_model expects (plant_name isn't a direct
    # Rec attribute - it's rec.plant.name) fails silently in a plain dict/attribute-access
    # test but throws a real 500 (ResponseValidationError) once FastAPI tries to serialize it.
    listing = marketplace_service.list_marketplace(db)
    for row in listing:
        MarketplaceListingOut.model_validate(row)


# --- creating a request -----------------------------------------------------------------------

def test_buyer_can_request_an_available_rec(db):
    request = marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", "Interested")
    assert request.status == "pending"
    assert request.rec_id == "REC-AVAIL"
    assert request.buyer_email == "buyer1@example.com"


def test_cannot_request_an_already_claimed_rec(db):
    with pytest.raises(ValueError):
        marketplace_service.create_request(db, "REC-CLAIMED", "buyer-1", "buyer1@example.com", None)


def test_cannot_request_a_rejected_rec(db):
    with pytest.raises(ValueError):
        marketplace_service.create_request(db, "REC-REJECTED", "buyer-1", "buyer1@example.com", None)


def test_cannot_request_a_retired_rec(db):
    with pytest.raises(ValueError):
        marketplace_service.create_request(db, "REC-RETIRED", "buyer-1", "buyer1@example.com", None)


def test_cannot_double_request_while_pending(db):
    marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)
    with pytest.raises(ValueError):
        marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)


def test_unknown_rec_raises_not_found(db):
    with pytest.raises(NotFoundError):
        marketplace_service.create_request(db, "REC-DOES-NOT-EXIST", "buyer-1", "buyer1@example.com", None)


# --- approving --------------------------------------------------------------------------------

def test_approve_transfers_ownership_and_records_ledger(db):
    request = marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)
    approved = marketplace_service.approve(db, request.id, "admin@example.com", "Looks good")
    assert approved.status == "approved"
    assert approved.decided_by == "admin@example.com"

    rec = db.get(Rec, "REC-AVAIL")
    assert rec.buyer_user_id == "buyer-1"
    assert rec.holder == "buyer1@example.com"

    from app.models import LedgerEntry, Transaction
    tx = db.query(Transaction).filter_by(rec_id="REC-AVAIL", kind="transfer").first()
    assert tx is not None
    assert tx.to_party == "buyer1@example.com"
    ledger_entry = db.query(LedgerEntry).filter_by(rec_id="REC-AVAIL", event_type="TRANSFERRED").first()
    assert ledger_entry is not None


def test_cannot_approve_twice(db):
    request = marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)
    marketplace_service.approve(db, request.id, "admin@example.com", None)
    with pytest.raises(ValueError):
        marketplace_service.approve(db, request.id, "admin@example.com", None)


def test_second_pending_request_fails_once_rec_is_claimed(db):
    # Two buyers request the same REC; approving one must invalidate the other rather than
    # silently letting a second approval re-transfer an already-claimed REC.
    req_a = marketplace_service.create_request(db, "REC-AVAIL", "buyer-a", "a@example.com", None)
    # A second buyer can't even file a request once the first is pending? They can - only
    # actual claim (buyer_user_id set) blocks new requests, not a pending one from someone
    # else. This documents that intentional choice: first-come-first-served happens at
    # approval time, not request time.
    req_b = marketplace_service.create_request(db, "REC-AVAIL", "buyer-b", "b@example.com", None)
    marketplace_service.approve(db, req_a.id, "admin@example.com", None)
    with pytest.raises(ValueError):
        marketplace_service.approve(db, req_b.id, "admin@example.com", None)


# --- rejecting --------------------------------------------------------------------------------

def test_reject_leaves_rec_unclaimed(db):
    request = marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)
    rejected = marketplace_service.reject(db, request.id, "admin@example.com", "Not eligible")
    assert rejected.status == "rejected"
    assert rejected.decision_note == "Not eligible"
    rec = db.get(Rec, "REC-AVAIL")
    assert rec.buyer_user_id is None
    # Still listed on the marketplace since it was never actually claimed.
    assert "REC-AVAIL" in {r["id"] for r in marketplace_service.list_marketplace(db)}


def test_cannot_reject_twice(db):
    request = marketplace_service.create_request(db, "REC-AVAIL", "buyer-1", "buyer1@example.com", None)
    marketplace_service.reject(db, request.id, "admin@example.com", None)
    with pytest.raises(ValueError):
        marketplace_service.reject(db, request.id, "admin@example.com", None)


def test_unknown_request_id_raises_not_found(db):
    with pytest.raises(NotFoundError):
        marketplace_service.approve(db, 99999, "admin@example.com", None)
