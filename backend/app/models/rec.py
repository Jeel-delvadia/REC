from datetime import date, datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.plant import Plant


class Rec(Base):
    """A Renewable Energy Certificate for one plant's generation over a date range."""

    __tablename__ = "recs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), index=True)
    period_start: Mapped[date]
    period_end: Mapped[date]
    energy_mwh: Mapped[float]
    issued_at: Mapped[datetime]
    holder: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | approved | rejected | reported
    # Copied from the latest VerificationResult so lists can filter and sort without a join.
    risk_score: Mapped[int | None] = mapped_column(index=True)
    risk_band: Mapped[str | None] = mapped_column(String(16), index=True)
    verified_at: Mapped[datetime | None]

    plant: Mapped[Plant] = relationship(lazy="joined")
