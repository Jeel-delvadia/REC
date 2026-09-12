from datetime import date

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Generation(Base):
    """One day of metered output for one plant.

    `meter_id` is nullable (RS-02): older/simulated rows may predate meters. New rows should
    always carry one - RS-05's fingerprint needs it to identify a generation event uniquely.
    """

    __tablename__ = "generation"
    __table_args__ = (UniqueConstraint("plant_id", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), index=True)
    meter_id: Mapped[str | None] = mapped_column(ForeignKey("meters.id"), index=True)
    day: Mapped[date] = mapped_column(index=True)
    energy_kwh: Mapped[float]
    # Daily solar irradiation (kWh/m²). When empty it is fetched from Open-Meteo at verification time.
    irradiation_kwh_m2: Mapped[float | None]
