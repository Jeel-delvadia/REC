from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import PublicVerification, ReportOut
from app.services import report_service

router = APIRouter(tags=["reports"])


@router.get("/public/verify/{rec_id}", response_model=PublicVerification)
def public_verify(rec_id: str, db: Session = Depends(get_db)):
    return report_service.public_verification(db, rec_id)


@router.get("/recs/{rec_id}/report", response_model=ReportOut)
def get_report(rec_id: str, db: Session = Depends(get_db)):
    return report_service.build_report(db, rec_id)
