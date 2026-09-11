from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.common import RecStatus, RiskBand
from app.schemas.rec import PlantOut, RecCreate, RecDetail, RecPage, VerificationOut
from app.services import rec_service, verification_service

router = APIRouter(prefix="/recs", tags=["recs"])


@router.get("", response_model=RecPage)
def list_recs(
    search: str | None = None,
    band: RiskBand | None = None,
    min_score: int | None = Query(None, ge=0, le=100),
    status: RecStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return rec_service.search(
        db, search=search, band=band, min_score=min_score, status=status, limit=limit, offset=offset
    )


@router.get("/plants", response_model=list[PlantOut])
def list_plants(db: Session = Depends(get_db)):
    return rec_service.list_plants(db)


@router.post("", response_model=RecDetail, status_code=201)
def create_rec(body: RecCreate, db: Session = Depends(get_db)):
    try:
        return rec_service.create_rec(db, body)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/{rec_id}", response_model=RecDetail)
def get_rec(rec_id: str, db: Session = Depends(get_db)):
    return rec_service.get_detail(db, rec_id)


@router.post("/{rec_id}/verify", response_model=VerificationOut)
def verify_rec(rec_id: str, db: Session = Depends(get_db)):
    return verification_service.verify_rec(db, rec_id)
