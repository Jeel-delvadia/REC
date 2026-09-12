from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Auditor, get_current_auditor
from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db), viewer: Auditor = Depends(get_current_auditor)):
    return dashboard_service.summary(db, viewer=viewer)
