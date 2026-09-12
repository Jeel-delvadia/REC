"""The public verification view and the downloadable audit report.

QR rendering moved client-side (RS-14, qrcode.react) - it only ever encoded public_url()
below, which the frontend already gets from these two responses, so there's nothing server-side
left to generate. public_url() stays here: both public_verification() and build_report() return it.
"""
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.services import audit_service, rec_service


def public_url(rec_id: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verify/{rec_id}"


def public_verification(db: Session, rec_id: str) -> dict:
    rec = rec_service.get_rec(db, rec_id)
    plant = rec.plant
    return {
        "rec_id": rec.id,
        "plant_name": plant.name,
        "plant_location": f"{plant.latitude:.2f}, {plant.longitude:.2f}",
        "capacity_kw": plant.capacity_kw,
        "energy_mwh": rec.energy_mwh,
        "period_start": rec.period_start,
        "period_end": rec.period_end,
        "status": rec.status,
        "risk_score": rec.risk_score,
        "risk_band": rec.risk_band,
        "verified_at": rec.verified_at,
        "ledger_hash": audit_service.latest_hash(db, rec.id),
        "ledger_valid": audit_service.verify_ledger(db)["valid"],
        "verify_url": public_url(rec.id),
    }


def build_report(db: Session, rec_id: str) -> dict:
    return {
        "generated_at": utcnow(),
        "public_url": public_url(rec_id),
        "rec": rec_service.get_detail(db, rec_id),
        "history": audit_service.history(db, rec_id),
        "ledger": audit_service.verify_ledger(db),
    }
