"""Auditor actions and the hash-chained ledger that records every event.

Ledger event types are the report's four (§8): ISSUED, TRANSFERRED, VERIFIED and
AUDITOR_ACTION - every auditor action writes AUDITOR_ACTION, with the specific action
name inside the payload, not as its own event type.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.engines import ledger
from app.models import AuditAction, LedgerEntry, VerificationResult
from app.services import alert_service
from app.services.rec_service import get_rec

# New REC status for each action that changes status. request_verification and note leave
# a REC's ledger event type as AUDITOR_ACTION either way - see record_action.
ACTION_STATUS = {"approve": "approved", "reject": "rejected", "report": "reported", "request_verification": "pending"}


def append_ledger(db: Session, event_type: str, rec_id: str | None, payload: dict) -> LedgerEntry:
    """Add an entry chained to the current head. Payload values must be JSON-native (str, int, float, bool)."""
    head = db.scalars(select(LedgerEntry).order_by(LedgerEntry.id.desc()).limit(1)).first()
    prev_hash = head.hash if head else ledger.GENESIS_HASH
    created_at = utcnow()
    entry = LedgerEntry(
        rec_id=rec_id,
        event_type=event_type,
        payload=payload,
        created_at=created_at,
        prev_hash=prev_hash,
        hash=ledger.compute_hash(prev_hash, event_type, rec_id, payload, created_at.isoformat()),
    )
    db.add(entry)
    db.flush()  # so the next append in this transaction sees this entry as the head
    return entry


def record_action(db: Session, rec_id: str, action: str, auditor: str, note: str | None) -> dict:
    rec = get_rec(db, rec_id)
    audit = AuditAction(rec_id=rec.id, action=action, auditor=auditor, note=note, created_at=utcnow())
    db.add(audit)
    if action in ACTION_STATUS:
        rec.status = ACTION_STATUS[action]
        alert_service.acknowledge_for_rec(db, rec.id)  # a decision closes the REC's open alerts

    payload = {"action": action, "auditor": auditor, "note": note, "status": rec.status}
    if action == "report":
        # Escalation record (report §9): attach a snapshot of the latest checks and explanation,
        # so the evidence behind a fraud report survives even if the REC is re-verified later.
        latest = db.scalars(
            select(VerificationResult).where(VerificationResult.rec_id == rec.id).order_by(VerificationResult.id.desc())
        ).first()
        if latest:
            payload["evidence"] = {
                "risk_score": latest.risk_score,
                "risk_band": latest.risk_band,
                "checks": [{"name": c["name"], "status": c["status"], "summary": c["summary"]} for c in latest.checks],
                "explanation": latest.explanation,
            }

    entry = append_ledger(db, "AUDITOR_ACTION", rec.id, payload)
    db.commit()
    db.refresh(audit)
    return {"action": audit, "rec_status": rec.status, "ledger_hash": entry.hash}


def history(db: Session, rec_id: str) -> list[LedgerEntry]:
    get_rec(db, rec_id)
    return list(db.scalars(select(LedgerEntry).where(LedgerEntry.rec_id == rec_id).order_by(LedgerEntry.id)).all())


def latest_hash(db: Session, rec_id: str) -> str | None:
    return db.scalar(
        select(LedgerEntry.hash).where(LedgerEntry.rec_id == rec_id).order_by(LedgerEntry.id.desc()).limit(1)
    )


def verify_ledger(db: Session) -> dict:
    entries = db.scalars(select(LedgerEntry).order_by(LedgerEntry.id))
    return ledger.verify_chain(
        {
            "id": e.id,
            "event_type": e.event_type,
            "rec_id": e.rec_id,
            "payload": e.payload,
            "created_at": e.created_at.isoformat(),
            "prev_hash": e.prev_hash,
            "hash": e.hash,
        }
        for e in entries
    )
