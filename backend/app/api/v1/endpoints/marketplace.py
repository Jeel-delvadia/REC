from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import Auditor, get_current_auditor, require_role
from app.core.database import get_db
from app.schemas.purchase_request import (
    MarketplaceListingOut, PurchaseRequestCreate, PurchaseRequestDecision, PurchaseRequestOut,
)
from app.services import NotFoundError, marketplace_service

router = APIRouter(tags=["marketplace"])


@router.get("/marketplace", response_model=list[MarketplaceListingOut])
def get_marketplace(db: Session = Depends(get_db), _viewer: Auditor = Depends(get_current_auditor)):
    """RS-24: RECs with no buyer linked yet, open for any signed-in buyer to request."""
    return marketplace_service.list_marketplace(db)


@router.post("/recs/{rec_id}/purchase-requests", response_model=PurchaseRequestOut, status_code=201)
def request_purchase(
    rec_id: str, body: PurchaseRequestCreate, db: Session = Depends(get_db),
    buyer: Auditor = Depends(require_role("buyer")),
):
    try:
        return marketplace_service.create_request(db, rec_id, buyer.id, buyer.email, body.note)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.get("/purchase-requests", response_model=list[PurchaseRequestOut])
def list_purchase_requests(
    status: str | None = None, db: Session = Depends(get_db),
    viewer: Auditor = Depends(get_current_auditor),
):
    # A buyer sees only their own requests; registry_admin/auditor see everyone's, to review.
    if viewer.role == "buyer":
        return marketplace_service.list_requests(db, buyer_user_id=viewer.id, status=status)
    if viewer.role in ("registry_admin", "auditor"):
        return marketplace_service.list_requests(db, status=status)
    raise HTTPException(status_code=403, detail="Only buyers and auditors can view purchase requests.")


@router.post("/purchase-requests/{request_id}/approve", response_model=PurchaseRequestOut)
def approve_purchase_request(
    request_id: int, body: PurchaseRequestDecision, db: Session = Depends(get_db),
    auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    try:
        return marketplace_service.approve(db, request_id, auditor.email, body.note)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))


@router.post("/purchase-requests/{request_id}/reject", response_model=PurchaseRequestOut)
def reject_purchase_request(
    request_id: int, body: PurchaseRequestDecision, db: Session = Depends(get_db),
    auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    try:
        return marketplace_service.reject(db, request_id, auditor.email, body.note)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))
