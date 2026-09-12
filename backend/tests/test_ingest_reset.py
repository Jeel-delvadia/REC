"""Regression test for a real bug found running ingest against Postgres (Supabase): resetting
demo data crashed with `ForeignKeyViolation: ... still referenced from table "user_profiles"`
because `UserProfile.plant_id` (added later, for RBAC) was never accounted for in
`ingest_service.RESET_ORDER`. SQLite doesn't enforce foreign keys by default, so this was
invisible in every prior test run and every local dev session - only a real Postgres database
with an actual signed-in plant_operator account ever hit it. Foreign keys are turned on below
specifically so this suite catches that class of bug instead of relying on production to find it.

The fix has two parts, both covered here: a genuine child of a REC (PurchaseRequest) now gets
wiped alongside it like Transaction/LedgerEntry already were, while a real user account
(UserProfile) is never deleted - only its plant_id scoping pointer is cleared - since a data
reset must never make someone's login disappear.
"""
from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.database import Base
from app.models import Plant, PurchaseRequest, Rec, UserProfile
from app.services import ingest_service

PLANTS_CSV = "id,name,owner,latitude,longitude,capacity_kw,technology,commissioned_on\nPLT-NEW,New Solar Park,New Co,10.0,20.0,1000,solar,\n"
GENERATION_CSV = "plant_id,meter_id,day,energy_kwh,irradiation_kwh_m2\nPLT-NEW,,2026-01-01,500,5.5\n"
RECS_CSV = "id,plant_id,period_start,period_end,energy_mwh,issued_at,holder,meter_id,interval_start,interval_end,issuer\nREC-NEW,PLT-NEW,2026-01-01,2026-01-01,0.5,2026-01-02T00:00:00,New Holder Co,,,,\n"
TRANSACTIONS_CSV = "rec_id,from_party,to_party,timestamp,kind\nREC-NEW,,New Holder Co,2026-01-02T00:00:00,issue\n"


@pytest.fixture
def db(tmp_path):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    # SQLite ignores foreign keys unless a connection explicitly turns them on - without this,
    # this exact test would pass even with the old buggy RESET_ORDER, since SQLite would just
    # silently let the DELETE through. Postgres never needed this: it enforces FKs unconditionally.
    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    session.add(Plant(id="PLT-001", name="Old Solar Park", owner="Old Co", latitude=1.0, longitude=1.0, capacity_kw=500, technology="solar"))
    session.add(Rec(
        id="REC-OLD", plant_id="PLT-001", period_start=date(2026, 1, 1), period_end=date(2026, 1, 1),
        energy_mwh=1.0, issued_at=date(2026, 1, 1), holder="Old Holder Co",
    ))
    session.add(UserProfile(id="user-1", email="operator@example.com", role="plant_operator", plant_id="PLT-001"))
    session.commit()
    session.add(PurchaseRequest(rec_id="REC-OLD", buyer_user_id="buyer-1", buyer_email="buyer@example.com"))
    session.commit()

    for name, content in [
        ("plants.csv", PLANTS_CSV), ("generation.csv", GENERATION_CSV),
        ("recs.csv", RECS_CSV), ("transactions.csv", TRANSACTIONS_CSV),
    ]:
        (tmp_path / name).write_text(content, encoding="utf-8")

    yield session, tmp_path
    session.close()


def test_reset_survives_a_real_user_profile_scoped_to_a_plant(db):
    session, directory = db

    result = ingest_service.load_csv_data(session, reset=True, verify=False, directory=directory)

    assert result["plants"] == 1
    assert result["recs"] == 1

    profile = session.get(UserProfile, "user-1")
    assert profile is not None, "resetting demo data must never delete a real signed-in account"
    assert profile.role == "plant_operator", "the account's role must survive a reset unchanged"
    assert profile.plant_id is None, "the old plant is gone, so the stale scoping pointer must be cleared, not left dangling"


def test_reset_wipes_purchase_requests_tied_to_the_old_recs(db):
    session, directory = db

    ingest_service.load_csv_data(session, reset=True, verify=False, directory=directory)

    assert session.get(Rec, "REC-OLD") is None
    remaining = session.query(PurchaseRequest).all()
    assert remaining == [], "a purchase request about a REC that no longer exists shouldn't survive the reset"
