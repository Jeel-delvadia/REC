from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import Alert, Rec
from app.services.risk_service import HIGH_RISK_BANDS


def raise_for_verification(db: Session, rec: Rec, score: int, band: str, checks: list[dict]) -> Alert | None:
    """Open an alert for a high-risk result, unless an identical one is already open."""
    if band not in HIGH_RISK_BANDS:
        return None
    existing = db.scalars(
        select(Alert).where(Alert.rec_id == rec.id, Alert.severity == band, Alert.acknowledged.is_(False))
    ).first()
    if existing:
        return existing

    failing = [c["label"] for c in checks if c["status"] == "fail"]
    alert = Alert(
        rec_id=rec.id,
        severity=band,
        title=f"{rec.id} scored {score}/100 ({band} risk)",
        message=f"Failed checks: {', '.join(failing)}." if failing else "Several checks raised warnings.",
        created_at=utcnow(),
    )
    db.add(alert)
    return alert


def acknowledge_for_rec(db: Session, rec_id: str) -> None:
    db.execute(update(Alert).where(Alert.rec_id == rec_id, Alert.acknowledged.is_(False)).values(acknowledged=True))


def list_alerts(db: Session, *, open_only: bool = False, limit: int = 50) -> list[Alert]:
    query = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if open_only:
        query = query.where(Alert.acknowledged.is_(False))
    return list(db.scalars(query).all())


def count_open(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Alert).where(Alert.acknowledged.is_(False)))
