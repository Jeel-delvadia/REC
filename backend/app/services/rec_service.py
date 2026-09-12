from datetime import datetime
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import AuditAction, Plant, Rec, Transaction, VerificationResult
from app.schemas.rec import RecCreate
from app.services import NotFoundError, audit_service



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
    }


def list_plants(db: Session) -> list[Plant]:
    return db.scalars(select(Plant).order_by(Plant.name)).all()


def get_rec(db: Session, rec_id: str) -> Rec:
    rec = db.get(Rec, rec_id)
    if rec is None:
        raise NotFoundError(f"REC {rec_id} not found")
    return rec


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
) -> dict:
    query = select(Rec).join(Rec.plant)
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


def get_detail(db: Session, rec_id: str) -> dict:
    rec = get_rec(db, rec_id)
    actions = db.scalars(
        select(AuditAction).where(AuditAction.rec_id == rec_id).order_by(AuditAction.created_at.desc())
    ).all()
    return {
        **summarize(rec),
        "issued_at": rec.issued_at,
        "verified_at": rec.verified_at,
        "plant": rec.plant,
        "verification": latest_verification(db, rec_id),
        "actions": actions,
    }
