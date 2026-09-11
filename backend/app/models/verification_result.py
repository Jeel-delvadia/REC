from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class VerificationResult(Base):
    """One verification run: every check's outcome, the score, and the explanation shown to the auditor."""

    __tablename__ = "verification_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    rec_id: Mapped[str] = mapped_column(ForeignKey("recs.id"), index=True)
    risk_score: Mapped[int]
    risk_band: Mapped[str] = mapped_column(String(16))
    checks: Mapped[list] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    explanation_source: Mapped[str] = mapped_column(String(16))  # llm | template
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
