from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    rec_id: Mapped[str] = mapped_column(ForeignKey("recs.id"), index=True)
    severity: Mapped[str] = mapped_column(String(16))  # the risk band that raised it
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    acknowledged: Mapped[bool] = mapped_column(default=False)
