from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import PublicVerification
from app.services import report_service

router = APIRouter(tags=["reports"])


@router.get("/public/verify/{rec_id}", response_model=PublicVerification)
def public_verify(rec_id: str, db: Session = Depends(get_db)):
    return report_service.public_verification(db, rec_id)


@router.get("/recs/{rec_id}/report", response_class=Response)
def get_report(rec_id: str, db: Session = Depends(get_db)):
    """RS-15: a downloadable PDF (report §3, §10) - was JSON (ReportOut), now unused by the
    frontend (fetchRecReport never got wired to anything), so this is a clean swap, not a break."""
    pdf_bytes = report_service.build_pdf(db, rec_id)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{rec_id}-report.pdf"'},
    )
