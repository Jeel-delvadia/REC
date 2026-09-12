from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import Auditor, get_current_auditor, require_role
from app.core.database import get_db
from app.schemas.user import MeOut, RoleUpdate, UserProfileOut
from app.services import NotFoundError, user_service

router = APIRouter(tags=["users"])


@router.get("/auth/me", response_model=MeOut)
def get_me(viewer: Auditor = Depends(get_current_auditor)):
    """RS-21 (§9.5): the frontend calls this once after sign-in to learn its own role, so
    it can hide nav items and action buttons the caller isn't permitted to use."""
    return MeOut(id=viewer.id, email=viewer.email, role=viewer.role, plant_id=viewer.plant_id)


@router.get("/admin/users", response_model=list[UserProfileOut])
def list_users(db: Session = Depends(get_db), _admin: Auditor = Depends(require_role("registry_admin"))):
    return user_service.list_users(db)


@router.patch("/admin/users/{user_id}/role", response_model=UserProfileOut)
def set_user_role(
    user_id: str, body: RoleUpdate, db: Session = Depends(get_db),
    _admin: Auditor = Depends(require_role("registry_admin")),
):
    try:
        return user_service.set_role(db, user_id, body.role, body.plant_id)
    except NotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
