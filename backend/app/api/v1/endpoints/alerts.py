from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.alert import AlertOut
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    open_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return alert_service.list_alerts(db, open_only=open_only, limit=limit)
