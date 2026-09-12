from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import Auditor, require_role
from app.core.database import get_db
from app.schemas.data_quality import DataQualityReportOut
from app.schemas.ingest import IngestRequest, IngestResult
from app.services import ingest_service

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResult)
def ingest(
    body: IngestRequest = IngestRequest(), db: Session = Depends(get_db),
    # RS-21 (§9.5): only registry_admin/auditor trigger ingest - regulator is read-only,
    # plant_operator/buyer have no business wiping and reloading the whole dataset.
    _auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    return ingest_service.load_csv_data(db, reset=body.reset, verify=body.verify)


@router.get("/data-quality/latest", response_model=DataQualityReportOut)
def latest_data_quality_report(
    db: Session = Depends(get_db),
    _viewer: Auditor = Depends(require_role("registry_admin", "regulator", "auditor")),
):
    """RS-20 (§9.6): re-fetch the last ingest's data-quality report without re-running ingest -
    lets the Data Hub page show it again after a refresh."""
    report = ingest_service.latest_data_quality_report(db)
    if report is None:
        raise HTTPException(status_code=404, detail="No data-quality report yet - run an ingest first.")
    return report
