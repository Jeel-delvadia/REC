from datetime import datetime
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.engines.duplicate import fingerprint as compute_fingerprint
from app.models import AuditAction, Meter, Plant, Rec, Transaction, UserProfile, VerificationResult
from app.schemas.rec import PlantCreate, RecCreate
from app.services import NotFoundError, audit_service

# RS-19: rough centroids for a first-time "+ Add New Plant" submission that gives a state/city
# name but no coordinates. This is a deliberate approximation, not real geocoding - it exists
# only so the physics-plausibility engine (which needs *some* lat/long to fetch irradiation
# from Open-Meteo) has something to work with rather than failing outright. Matched by simple
# case-insensitive substring against the free-text `location` field, so "Gujarat, India" and
# "Gujarat" both resolve. Extend this list rather than requiring exact coordinates from users
# who often only know their state.
STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "andhra pradesh": (15.9129, 79.7400), "arunachal pradesh": (28.2180, 94.7278),
    "assam": (26.2006, 92.9376), "bihar": (25.0961, 85.3131), "chhattisgarh": (21.2787, 81.8661),
    "goa": (15.2993, 74.1240), "gujarat": (22.2587, 71.1924), "haryana": (29.0588, 76.0856),
    "himachal pradesh": (31.1048, 77.1734), "jharkhand": (23.6102, 85.2799),
    "karnataka": (15.3173, 75.7139), "kerala": (10.8505, 76.2711), "madhya pradesh": (22.9734, 78.6569),
    "maharashtra": (19.7515, 75.7139), "manipur": (24.6637, 93.9063), "meghalaya": (25.4670, 91.3662),
    "mizoram": (23.1645, 92.9376), "nagaland": (26.1584, 94.5624), "odisha": (20.9517, 85.0985),
    "punjab": (31.1471, 75.3412), "rajasthan": (27.0238, 74.2179), "sikkim": (27.5330, 88.5122),
    "tamil nadu": (11.1271, 78.6569), "telangana": (18.1124, 79.0193), "tripura": (23.9408, 91.9882),
    "uttar pradesh": (26.8467, 80.9462), "uttarakhand": (30.0668, 79.0193), "west bengal": (22.9868, 87.8550),
    "delhi": (28.7041, 77.1025), "chandigarh": (30.7333, 76.7794), "puducherry": (11.9416, 79.8083),
}
# Geographic center of India - the last-resort fallback when `location` matches nothing above.
INDIA_CENTER = (22.3511, 78.6677)


def _resolve_coordinates(data: PlantCreate) -> tuple[float, float, bool]:
    """Returns (latitude, longitude, was_approximated). Real coordinates always win."""
    if data.latitude is not None and data.longitude is not None:
        return data.latitude, data.longitude, False
    if data.location:
        needle = data.location.lower()
        for state, coords in STATE_CENTROIDS.items():
            if state in needle:
                return coords[0], coords[1], True
    return INDIA_CENTER[0], INDIA_CENTER[1], True


def _next_plant_id(db: Session) -> str:
    max_num = 0
    for pid in db.scalars(select(Plant.id)).all():
        if pid.startswith("PLT-"):
            try:
                max_num = max(max_num, int(pid.replace("PLT-", "")))
            except ValueError:
                pass
    return f"PLT-{max_num + 1:03d}"


def create_plant(db: Session, data: PlantCreate) -> Plant:
    """RS-19: registers a new generator/project on the fly, so issuing a REC no longer requires
    pre-seeding the plant via a CSV through the Data Hub."""
    latitude, longitude, approximated = _resolve_coordinates(data)
    plant = Plant(
        id=_next_plant_id(db),
        name=data.name,
        owner=data.owner,
        latitude=latitude,
        longitude=longitude,
        capacity_kw=data.capacity_kw,
        technology=data.technology,
        commissioned_on=data.commissioned_on,
        location=data.location,
    )
    db.add(plant)
    db.commit()
    db.refresh(plant)
    # Not part of the Plant row itself (nothing to redisplay later) - just tells the caller,
    # once, that physics checks on this plant will run against an approximate location.
    plant._coordinates_approximated = approximated  # type: ignore[attr-defined]
    return plant



def summarize(rec: Rec) -> dict:
    return {
        "id": rec.id,
        "plant_id": rec.plant_id,
        "plant_name": rec.plant.name,
        "period_start": rec.period_start,
        "period_end": rec.period_end,
        "energy_mwh": rec.energy_mwh,
        "holder": rec.holder,
        "status": rec.status,
        "risk_score": rec.risk_score,
        "risk_band": rec.risk_band,
        "rec_type": rec.rec_type,
        "issuing_authority": rec.issuing_authority,
        "generation_date": rec.generation_date,
        "rec_issued": rec.rec_issued,
        "certificate_status": rec.certificate_status,
    }


def list_plants(db: Session) -> list[Plant]:
    return db.scalars(select(Plant).order_by(Plant.name)).all()


def get_rec(db: Session, rec_id: str) -> Rec:
    rec = db.get(Rec, rec_id)
    if rec is None:
        raise NotFoundError(f"REC {rec_id} not found")
    return rec


# RS-21 (§9.5): roles whose view isn't scoped down at all - everyone else (plant_operator,
# buyer) only sees their own plant's or their own held RECs.
_UNSCOPED_ROLES = {"registry_admin", "regulator", "auditor"}


def visible_to_clause(viewer) -> tuple | None:
    """A SQLAlchemy filter clause for `viewer`'s role, or None if their role sees everything.
    Kept as one function - imported by dashboard_service too - so "who can see what" has
    exactly one place to read, matching how risk_service keeps every threshold in one place."""
    if viewer is None or viewer.role in _UNSCOPED_ROLES:
        return None
    if viewer.role == "plant_operator":
        return (Rec.plant_id == viewer.plant_id,)
    if viewer.role == "buyer":
        return (Rec.buyer_user_id == viewer.id,)
    return (False,)  # an unrecognised role sees nothing, rather than everything by accident


def search(
    db: Session,
    *,
    search: str | None = None,
    band: str | None = None,
    min_score: int | None = None,
    status: str | None = None,
    date_from=None,
    date_to=None,
    limit: int = 50,
    offset: int = 0,
    viewer=None,
) -> dict:
    query = select(Rec).join(Rec.plant)
    for clause in (visible_to_clause(viewer) or ()):
        query = query.where(clause)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(or_(Rec.id.ilike(like), Plant.name.ilike(like), Plant.owner.ilike(like), Rec.holder.ilike(like)))
    if band:
        query = query.where(Rec.risk_band == band)
    if min_score is not None:
        query = query.where(Rec.risk_score >= min_score)
    if status:
        query = query.where(Rec.status == status)
    # Overlap with [date_from, date_to], not containment - a REC whose period only partially
    # falls in the range still matches, the same way the dashboard's other filters are inclusive.
    if date_from:
        query = query.where(Rec.period_end >= date_from)
    if date_to:
        query = query.where(Rec.period_start <= date_to)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    recs = db.scalars(query.order_by(Rec.risk_score.desc().nulls_last(), Rec.id).limit(limit).offset(offset)).all()
    return {"items": [summarize(rec) for rec in recs], "total": total}


def create_rec(db: Session, data: RecCreate) -> dict:
    plant = db.get(Plant, data.plant_id)
    if not plant:
        raise NotFoundError(f"Plant {data.plant_id} not found")

    rec_id = data.id
    if not rec_id or not rec_id.strip():
        max_num = 500
        existing_ids = db.scalars(select(Rec.id)).all()
        for eid in existing_ids:
            if eid.startswith("REC-"):
                try:
                    num = int(eid.replace("REC-", ""))
                    if num >= max_num:
                        max_num = num + 1
                except ValueError:
                    pass
        rec_id = f"REC-{max_num:05d}"
    
    if db.get(Rec, rec_id):
        raise ValueError(f"REC with ID {rec_id} already exists")

    # RS-02: a REC always has a meter - fall back to the plant's default one if none was given,
    # provisioning it on the fly (the CSV ingest path does the same for rows that predate meters).
    meter_id = data.meter_id
    if not meter_id:
        meter_id = f"{data.plant_id}-M1"
        if not db.get(Meter, meter_id):
            db.add(Meter(id=meter_id, plant_id=data.plant_id))
    elif not db.get(Meter, meter_id):
        raise NotFoundError(f"Meter {meter_id} not found")

    now = utcnow()
    rec = Rec(
        id=rec_id,
        plant_id=data.plant_id,
        period_start=data.period_start,
        period_end=data.period_end,
        energy_mwh=data.energy_mwh,
        issued_at=now,
        holder=data.holder,
        status="pending",
        meter_id=meter_id,
        interval_start=data.interval_start,
        interval_end=data.interval_end,
        issuer=data.issuer,
        fingerprint=compute_fingerprint(
            data.plant_id, meter_id, data.interval_start or data.period_start,
            data.interval_end or data.period_end, data.energy_mwh,
        ),
        # RS-19: sensible defaults when the caller doesn't supply real-certificate metadata -
        # rec_type from the plant's own technology, issuing_authority from settings, and
        # generation_date falling back to the claimed period's start date.
        rec_type=data.rec_type or f"{plant.technology.capitalize()} Renewable Energy Certificate",
        issuing_authority=data.issuing_authority or settings.DEFAULT_ISSUING_AUTHORITY,
        generation_date=data.generation_date or data.period_start,
        rec_issued=data.rec_issued,
    )
    db.add(rec)

    tx = Transaction(
        rec_id=rec_id,
        from_party="Registry",
        to_party=data.holder,
        timestamp=now,
        kind="issue",
    )
    db.add(tx)

    payload = {
        "plant_id": rec.plant_id,
        "energy_mwh": rec.energy_mwh,
        "period": f"{rec.period_start}/{rec.period_end}",
        "holder": rec.holder,
        "at": now.isoformat(),
    }
    audit_service.append_ledger(db, "ISSUED", rec.id, payload)
    db.commit()

    # Automatically verify newly uploaded REC
    from app.services import verification_service
    verification_service.verify_rec(db, rec.id, use_llm=False)

    return get_detail(db, rec.id)



def latest_verification(db: Session, rec_id: str) -> VerificationResult | None:
    return db.scalars(
        select(VerificationResult)
        .where(VerificationResult.rec_id == rec_id)
        .order_by(VerificationResult.id.desc())
        .limit(1)
    ).first()


def _rec_visible_to_viewer(rec: Rec, viewer) -> bool:
    if viewer is None or viewer.role in _UNSCOPED_ROLES:
        return True
    if viewer.role == "plant_operator":
        return rec.plant_id == viewer.plant_id
    if viewer.role == "buyer":
        return rec.buyer_user_id == viewer.id
    return False


def get_detail(db: Session, rec_id: str, viewer=None) -> dict:
    rec = get_rec(db, rec_id)
    # Same "not found" rather than "forbidden" a scoped-out caller gets from search() above -
    # confirming a REC ID exists for a plant/buyer you can't otherwise see is its own small leak.
    if not _rec_visible_to_viewer(rec, viewer):
        raise NotFoundError(f"REC {rec_id} not found")
    actions = db.scalars(
        select(AuditAction).where(AuditAction.rec_id == rec_id).order_by(AuditAction.created_at.desc())
    ).all()
    buyer_email = None
    if rec.buyer_user_id:
        buyer_profile = db.get(UserProfile, rec.buyer_user_id)
        buyer_email = buyer_profile.email if buyer_profile else None
    return {
        **summarize(rec),
        "issued_at": rec.issued_at,
        "verified_at": rec.verified_at,
        "plant": rec.plant,
        "verification": latest_verification(db, rec_id),
        "actions": actions,
        "meter_id": rec.meter_id,
        "interval_start": rec.interval_start,
        "interval_end": rec.interval_end,
        "issuer": rec.issuer,
        "fingerprint": rec.fingerprint,
        "buyer_email": buyer_email,
    }


def assign_buyer(db: Session, rec_id: str, buyer_email: str) -> dict:
    """RS-23: links a REC to a buyer's own account by email, so it appears in that buyer's
    scoped dashboard/REC Explorer (visible_to_clause filters the buyer role on
    Rec.buyer_user_id). Deliberately separate from `holder`, the free-text display name on the
    certificate - a buyer's login email and the company name printed on a REC aren't reliably
    the same string, so this needs its own explicit link rather than a name match."""
    rec = get_rec(db, rec_id)
    profile = db.scalars(select(UserProfile).where(UserProfile.email == buyer_email)).first()
    if profile is None:
        raise NotFoundError(f"No account found for '{buyer_email}' - they need to sign up first.")
    if profile.role != "buyer":
        raise ValueError(f"'{buyer_email}' is a {profile.role}, not a buyer - only buyer accounts can be assigned to a REC.")
    rec.buyer_user_id = profile.id
    db.commit()
    return get_detail(db, rec_id)
