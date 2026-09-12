from datetime import date

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    owner: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float]
    longitude: Mapped[float]
    capacity_kw: Mapped[float]
    technology: Mapped[str] = mapped_column(String(32), default="solar")
    commissioned_on: Mapped[date | None]
    # RS-19: a human-readable place name ("Gujarat, India") for display on certificates and the
    # public verify page - lat/long stay the source of truth the physics engine actually uses
    # (Open-Meteo needs coordinates, not a place name), so this is display-only and nullable.
    location: Mapped[str | None] = mapped_column(String(160))
