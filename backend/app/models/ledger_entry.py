from datetime import datetime

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LedgerEntry(Base):
    """Append-only, SHA-256 hash-chained event log. Row order (id) is chain order."""

    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Deliberately not a foreign key, so ledger history outlives the rows it describes.
    rec_id: Mapped[str | None] = mapped_column(String(32), index=True)
    event_type: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime]
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)
