"""RS-24: buyer-initiated REC acquisition, gated behind auditor/admin approval - a buyer
requests, an auditor/admin decides, and only approval performs the real transfer (a Transaction
row plus a TRANSFERRED ledger entry). Nothing changes ownership without a human check first,
the same principle every other state change in this app already follows.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import utcnow
from app.models import PurchaseRequest, Rec, Transaction
from app.services import NotFoundError, audit_service, verification_service
from app.services.rec_service import get_rec

# A REC is listed on the marketplace only when it's unclaimed, active, and hasn't been
# rejected/reported - a buyer should never be able to request a REC an auditor has already
# flagged as fraudulent just because nobody's claimed it yet.
_INELIGIBLE_STATUSES = ("rejected", "reported")


def list_marketplace(db: Session) -> list[dict]:
    recs = db.scalars(
        select(Rec)
        .join(Rec.plant)
        .where(
            Rec.buyer_user_id.is_(None),
            Rec.certificate_status == "active",
            Rec.status.notin_(_INELIGIBLE_STATUSES),
        )
        .order_by(Rec.id)
    ).all()
    # MarketplaceListingOut.plant_name has no matching attribute on Rec itself (it's
    # rec.plant.name via the relationship) - build plain dicts rather than relying on
    # from_attributes to reach through a nested relationship it can't see.
    return [
        {
            "id": rec.id,
            "plant_id": rec.plant_id,
            "plant_name": rec.plant.name,
            "energy_mwh": rec.energy_mwh,
            "period_start": rec.period_start,
            "period_end": rec.period_end,
            "holder": rec.holder,
            "risk_score": rec.risk_score,
            "risk_band": rec.risk_band,
        }
        for rec in recs
    ]


def create_request(db: Session, rec_id: str, buyer_user_id: str, buyer_email: str, note: str | None) -> PurchaseRequest:
    rec = get_rec(db, rec_id)
    if rec.buyer_user_id is not None:
        raise ValueError(f"REC {rec_id} is already linked to a buyer account.")
    if rec.status in _INELIGIBLE_STATUSES:
        raise ValueError(f"REC {rec_id} has been {rec.status} and isn't available for purchase.")
    if rec.certificate_status != "active":
        raise ValueError(f"REC {rec_id} is {rec.certificate_status}, not available for purchase.")
    existing = db.scalars(
        select(PurchaseRequest).where(
            PurchaseRequest.rec_id == rec_id,
            PurchaseRequest.buyer_user_id == buyer_user_id,
            PurchaseRequest.status == "pending",
        )
    ).first()
    if existing:
        raise ValueError(f"You already have a pending request for {rec_id}.")

    request = PurchaseRequest(rec_id=rec_id, buyer_user_id=buyer_user_id, buyer_email=buyer_email, note=note)
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def list_requests(db: Session, *, buyer_user_id: str | None = None, status: str | None = None) -> list[PurchaseRequest]:
    query = select(PurchaseRequest).order_by(PurchaseRequest.requested_at.desc())
    if buyer_user_id:
        query = query.where(PurchaseRequest.buyer_user_id == buyer_user_id)
    if status:
        query = query.where(PurchaseRequest.status == status)
    return list(db.scalars(query).all())


def _get_request(db: Session, request_id: int) -> PurchaseRequest:
    request = db.get(PurchaseRequest, request_id)
    if request is None:
        raise NotFoundError(f"Purchase request {request_id} not found")
    return request


def approve(db: Session, request_id: int, decided_by: str, note: str | None) -> PurchaseRequest:
    request = _get_request(db, request_id)
    if request.status != "pending":
        raise ValueError(f"Request {request_id} was already {request.status}.")
    rec = get_rec(db, request.rec_id)
    if rec.buyer_user_id is not None:
        raise ValueError(f"REC {request.rec_id} was already claimed by another buyer while this request was pending.")

    now = utcnow()
    old_holder = rec.holder
    rec.holder = request.buyer_email
    rec.buyer_user_id = request.buyer_user_id

    db.add(Transaction(rec_id=rec.id, from_party=old_holder, to_party=request.buyer_email, timestamp=now, kind="transfer"))
    audit_service.append_ledger(
        db, "TRANSFERRED", rec.id, {"from": old_holder, "to": request.buyer_email, "at": now.isoformat()}
    )

    request.status = "approved"
    request.decided_by = decided_by
    request.decision_note = note
    request.decided_at = now
    db.commit()

    # Keep the provenance/transfer-history check in sync with the new transfer - a light,
    # deterministic re-verify (no LLM), same as every other state change this app re-scores for.
    verification_service.verify_rec(db, rec.id, use_llm=False)

    db.refresh(request)
    return request


def reject(db: Session, request_id: int, decided_by: str, note: str | None) -> PurchaseRequest:
    request = _get_request(db, request_id)
    if request.status != "pending":
        raise ValueError(f"Request {request_id} was already {request.status}.")
    request.status = "rejected"
    request.decided_by = decided_by
    request.decision_note = note
    request.decided_at = utcnow()
    db.commit()
    db.refresh(request)
    return request
