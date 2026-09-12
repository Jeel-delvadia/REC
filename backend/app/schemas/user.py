from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class MeOut(ORMModel):
    """RS-21 (§9.5): what the frontend asks right after sign-in to know who it's talking to -
    the role and plant_id drive which nav items, buttons and dashboard scope it renders."""
    id: str
    email: str
    role: str
    plant_id: str | None = None


class UserProfileOut(ORMModel):
    id: str
    email: str
    role: str
    plant_id: str | None = None
    created_at: datetime


class RoleUpdate(BaseModel):
    role: str
    plant_id: str | None = None  # only meaningful when role == "plant_operator"
