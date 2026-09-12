from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Auditor, require_role
from app.core.database import get_db
from app.schemas.graph import GraphOut
from app.services import graph_service

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("", response_model=GraphOut)
def get_graph(
    rec_id: str | None = None, db: Session = Depends(get_db),
    # RS-21 (§9.5): oversight tooling, same three roles as ledger verification.
    _viewer: Auditor = Depends(require_role("registry_admin", "regulator", "auditor")),
):
    return graph_service.graph_for(db, rec_id)
