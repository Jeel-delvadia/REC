from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import Alert, Rec
from app.services.risk_service import FRAUD_BAND


def _open_alert(db: Session, rec_id: str, severity: str, title: str, message: str) -> Alert | None:
    """Skip raising a duplicate of an alert that's already open for this REC and severity."""
    existing = db.scalars(
        select(Alert).where(Alert.rec_id == rec_id, Alert.severity == severity, Alert.acknowledged.is_(False))
    ).first()
    if existing:
        return existing
    alert = Alert(rec_id=rec_id, severity=severity, title=title, message=message, created_at=utcnow())
    db.add(alert)
    return alert


def raise_for_verification(db: Session, rec: Rec, score: int, band: str, checks: list[dict]) -> Alert | None:
    """Report §6/§10: only Likely Fraud (81+) raises an alert here - High Risk and Suspicious are
    prioritised in the Review queue (dashboard) instead. See raise_for_ledger_failure and
    raise_for_circular_transfer for the other two alert types (report §8, §10)."""
    if band != FRAUD_BAND:
        return None
    failing = [c["label"] for c in checks if c["status"] == "fail"]
    return _open_alert(
        db, rec.id, band,
        title=f"{rec.id} scored {score}/100 (likely fraud)",
        message=f"Failed checks: {', '.join(failing)}." if failing else "Several checks raised warnings.",
    )


def raise_for_ledger_failure(db: Session, rec: Rec, reason: str) -> Alert:
    """Report §8: a broken hash chain or a REC row that no longer matches its ledger history."""
    return _open_alert(
        db, rec.id, "ledger_integrity",
        title=f"{rec.id} failed ledger integrity",
        message=reason,
    )


def raise_for_circular_transfer(db: Session, rec: Rec, cycle_parties: list[str]) -> Alert:
    """Report §7/§10: a circular ownership transfer, independent of the REC's risk score."""
    return _open_alert(
        db, rec.id, "circular_transfer",
        title=f"{rec.id} has a circular ownership transfer",
        message=f"Ownership loops back through: {', '.join(cycle_parties)}.",
    )


def acknowledge_for_rec(db: Session, rec_id: str) -> None:
    db.execute(update(Alert).where(Alert.rec_id == rec_id, Alert.acknowledged.is_(False)).values(acknowledged=True))


def list_alerts(db: Session, *, open_only: bool = False, limit: int = 50) -> list[Alert]:
    query = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if open_only:
        query = query.where(Alert.acknowledged.is_(False))
    return list(db.scalars(query).all())


def count_open(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Alert).where(Alert.acknowledged.is_(False)))
