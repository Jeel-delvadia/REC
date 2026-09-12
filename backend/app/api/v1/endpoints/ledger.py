from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Auditor, require_role
from app.core.database import get_db
from app.schemas.ledger import LedgerEntryOut, LedgerVerifyOut
from app.services import audit_service

router = APIRouter(tags=["ledger"])

# RS-21 (§9.5): internal investigation tooling - not scoped per-plant/buyer like the REC
# list, just gated to the three roles that do oversight work at all.
_OVERSIGHT_ROLES = ("registry_admin", "regulator", "auditor")


@router.get("/recs/{rec_id}/history", response_model=list[LedgerEntryOut])
def get_history(rec_id: str, db: Session = Depends(get_db), _viewer: Auditor = Depends(require_role(*_OVERSIGHT_ROLES))):
    return audit_service.history(db, rec_id)


@router.get("/ledger/verify", response_model=LedgerVerifyOut)
def verify_ledger(db: Session = Depends(get_db), _viewer: Auditor = Depends(require_role(*_OVERSIGHT_ROLES))):
    return audit_service.verify_ledger(db)
