from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import Auditor, get_current_auditor, require_role
from app.core.database import get_db
from app.schemas.common import RecStatus, RiskBand
from app.schemas.rec import BuyerAssign, PlantCreate, PlantOut, RecCreate, RecDetail, RecPage, VerificationOut
from app.services import rec_service, verification_service

router = APIRouter(prefix="/recs", tags=["recs"])


@router.get("", response_model=RecPage)
def list_recs(
    search: str | None = None,
    date_from: date | None = Query(None, description="only RECs whose period_end is on or after this date"),
    date_to: date | None = Query(None, description="only RECs whose period_start is on or before this date"),
    band: RiskBand | None = None,
    min_score: int | None = Query(None, ge=0, le=100),
    status: RecStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    # RS-21 (§9.5): the frontend always attaches whatever session token it has (see
    # api/client.js's authHeader), so this costs signed-in callers nothing new - it's what lets
    # plant_operator/buyer get scoped down to their own plant/RECs instead of seeing everyone's.
    viewer: Auditor = Depends(get_current_auditor),
):
    return rec_service.search(
        db, search=search, band=band, min_score=min_score, status=status,
        date_from=date_from, date_to=date_to, limit=limit, offset=offset, viewer=viewer,
    )


@router.get("/plants", response_model=list[PlantOut])
def list_plants(db: Session = Depends(get_db)):
    return rec_service.list_plants(db)


@router.post("/plants", response_model=PlantOut, status_code=201)
def create_plant(
    body: PlantCreate, db: Session = Depends(get_db),
    _auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    """RS-19: registers a new generator/project from the Upload modal's '+ Add New Plant' step,
    instead of requiring a CSV pre-seed through the Data Hub for every plant."""
    return rec_service.create_plant(db, body)


@router.post("", response_model=RecDetail, status_code=201)
def create_rec(
    body: RecCreate, db: Session = Depends(get_db),
    _auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    try:
        return rec_service.create_rec(db, body)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/{rec_id}", response_model=RecDetail)
def get_rec(rec_id: str, db: Session = Depends(get_db), viewer: Auditor = Depends(get_current_auditor)):
    return rec_service.get_detail(db, rec_id, viewer=viewer)


@router.post("/{rec_id}/verify", response_model=VerificationOut)
def verify_rec(
    rec_id: str, db: Session = Depends(get_db),
    _auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    return verification_service.verify_rec(db, rec_id)


@router.post("/{rec_id}/buyer", response_model=RecDetail)
def assign_buyer(
    rec_id: str, body: BuyerAssign, db: Session = Depends(get_db),
    _auditor: Auditor = Depends(require_role("registry_admin", "auditor")),
):
    """RS-23: links this REC to a buyer's own account, so it shows up in their scoped
    dashboard/REC Explorer - without this, a brand-new buyer account has nothing assigned to
    it and correctly sees zero RECs, not a bug."""
    try:
        return rec_service.assign_buyer(db, rec_id, body.buyer_email)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
