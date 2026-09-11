from datetime import date

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Generation(Base):
    """One day of metered output for one plant."""

    __tablename__ = "generation"
    __table_args__ = (UniqueConstraint("plant_id", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), index=True)
    day: Mapped[date] = mapped_column(index=True)
    energy_kwh: Mapped[float]
    # Daily solar irradiation (kWh/m²). When empty it is fetched from Open-Meteo at verification time.
    irradiation_kwh_m2: Mapped[float | None]
