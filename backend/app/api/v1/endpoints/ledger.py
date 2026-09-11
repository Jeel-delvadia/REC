from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ledger import LedgerEntryOut, LedgerVerifyOut
from app.services import audit_service

router = APIRouter(tags=["ledger"])


@router.get("/recs/{rec_id}/history", response_model=list[LedgerEntryOut])
def get_history(rec_id: str, db: Session = Depends(get_db)):
    return audit_service.history(db, rec_id)


@router.get("/ledger/verify", response_model=LedgerVerifyOut)
def verify_ledger(db: Session = Depends(get_db)):
    return audit_service.verify_ledger(db)
