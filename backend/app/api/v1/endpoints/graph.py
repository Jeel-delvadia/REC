from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.graph import GraphOut
from app.services import graph_service

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("", response_model=GraphOut)
def get_graph(rec_id: str | None = None, db: Session = Depends(get_db)):
    return graph_service.graph_for(db, rec_id)
