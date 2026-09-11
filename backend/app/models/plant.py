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
