from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class AuditAction(Base):
    __tablename__ = "audit_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    rec_id: Mapped[str] = mapped_column(ForeignKey("recs.id"), index=True)
    action: Mapped[str] = mapped_column(String(16))  # approve | reject | report | note
    auditor: Mapped[str] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
