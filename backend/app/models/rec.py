from datetime import date, datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.plant import Plant


class Rec(Base):
    """A Renewable Energy Certificate for one plant's generation over a date range.

    RS-02 adds meter/interval/issuer/fingerprint as nullable, alongside the original
    period_start/period_end/energy_mwh rather than replacing them - existing RECs (and the
    engines that read period_start/period_end) keep working; new RECs should set all of it.
    """

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

    # RS-02: meter + the precise claimed interval (report §5 works in one-hour intervals).
    meter_id: Mapped[str | None] = mapped_column(ForeignKey("meters.id"), index=True)
    interval_start: Mapped[datetime | None]
    interval_end: Mapped[datetime | None]
    issuer: Mapped[str | None] = mapped_column(String(120))
    # RS-05: SHA-256(plant_id|meter_id|interval_start|interval_end|energy_mwh). Deliberately NOT
    # unique: the report's own worked example (§7) has REC-002 registered with the same
    # fingerprint as REC-001, then flagged DOUBLE COUNTING DETECTED by verification - the auditor
    # investigates and decides, rather than the insert failing outright.
    fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)

    plant: Mapped[Plant] = relationship(lazy="joined")
