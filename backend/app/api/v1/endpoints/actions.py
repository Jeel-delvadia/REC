from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Auditor, get_current_auditor
from app.core.database import get_db
from app.schemas.action import ActionCreate, ActionResult
from app.services import audit_service

router = APIRouter(prefix="/recs", tags=["actions"])


@router.post("/{rec_id}/actions", response_model=ActionResult, status_code=201)
def submit_action(
    rec_id: str, body: ActionCreate, db: Session = Depends(get_db), auditor: Auditor = Depends(get_current_auditor)
):
    return audit_service.record_action(db, rec_id, body.action, auditor.email, body.note)
