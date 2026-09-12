from datetime import datetime

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class DataQualityReport(Base):
    """RS-20 (§9.6): the outcome of one data-quality pass over an ingest batch - persisted
    like a VerificationResult so it can be re-displayed on the Data Hub without re-running the
    ingest, rather than only ever existing as a log line."""

    __tablename__ = "data_quality_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(64))  # e.g. "csv_ingest"
    score: Mapped[int]  # 0-100, 100 = nothing to report
    issues: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
