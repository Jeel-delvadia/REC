from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ROLES
from app.models import UserProfile
from app.services import NotFoundError


def list_users(db: Session) -> list[UserProfile]:
    return list(db.scalars(select(UserProfile).order_by(UserProfile.email)).all())


def set_role(db: Session, user_id: str, role: str, plant_id: str | None) -> UserProfile:
    if role not in ROLES:
        raise ValueError(f"Unknown role '{role}'. Must be one of: {', '.join(ROLES)}.")
    if role == "plant_operator" and not plant_id:
        raise ValueError("plant_operator role requires a plant_id.")
    profile = db.get(UserProfile, user_id)
    if profile is None:
        raise NotFoundError(f"No user profile for '{user_id}' - they need to sign in at least once first.")
    profile.role = role
    profile.plant_id = plant_id if role == "plant_operator" else None
    db.commit()
    db.refresh(profile)
    return profile
