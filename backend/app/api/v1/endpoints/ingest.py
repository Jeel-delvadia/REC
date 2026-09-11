from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ingest import IngestRequest, IngestResult
from app.services import ingest_service

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResult)
def ingest(body: IngestRequest = IngestRequest(), db: Session = Depends(get_db)):
    return ingest_service.load_csv_data(db, reset=body.reset, verify=body.verify)
