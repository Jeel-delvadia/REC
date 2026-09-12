from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Auditor, require_role
from app.core.database import get_db
from app.schemas.action import ActionCreate, ActionResult
from app.services import audit_service

router = APIRouter(prefix="/recs", tags=["actions"])


@router.post("/{rec_id}/actions", response_model=ActionResult, status_code=201)
def submit_action(
    rec_id: str, body: ActionCreate, db: Session = Depends(get_db),
    # RS-21 (§9.5): only registry_admin and auditor take audit actions - regulator is
    # read-only oversight, and neither plant_operator nor buyer touch this at all.
    auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    return audit_service.record_action(db, rec_id, body.action, auditor.email, body.note)
