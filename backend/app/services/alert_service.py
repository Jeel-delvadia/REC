from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import Alert, Rec
from app.services.risk_service import FRAUD_BAND

# RS-21: rec_service imports audit_service, which imports this module (for raise_for_*) - a
# module-level `from app.services.rec_service import visible_to_clause` here closes that into
# an import cycle. It only broke when something imported rec_service directly before anything
# else touched app.services (e.g. a standalone script) - the FastAPI app's own startup order
# happened to load audit_service first, which papered over it. Deferred into list_alerts()
# below instead: by the time any function actually runs, every module has finished loading
# regardless of which one a caller happened to import first.


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


def list_alerts(db: Session, *, open_only: bool = False, limit: int = 50, viewer=None) -> list[Alert]:
    # RS-21 (§9.5): a plant_operator/buyer only sees alerts for RECs visible to them - same
    # scoping rule as the REC list and dashboard, joined through here since Alert only carries
    # a rec_id, not a plant_id/buyer_user_id of its own.
    from app.services.rec_service import visible_to_clause  # deferred - see module docstring above
    scope = visible_to_clause(viewer)
    query = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if scope:
        query = query.join(Rec, Rec.id == Alert.rec_id).where(*scope)
    if open_only:
        query = query.where(Alert.acknowledged.is_(False))
    return list(db.scalars(query).all())


def count_open(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Alert).where(Alert.acknowledged.is_(False)))
