from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class PurchaseRequest(Base):
    """RS-24: a buyer's request to acquire a REC that isn't already linked to a buyer account.
    Approving one performs the real transfer (Transaction + TRANSFERRED ledger entry, see
    marketplace_service.approve) - nothing changes ownership without an auditor/admin looking
    at it first, same principle as every other action this app records on the ledger.
    """

    __tablename__ = "purchase_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    rec_id: Mapped[str] = mapped_column(ForeignKey("recs.id"), index=True)
    buyer_user_id: Mapped[str] = mapped_column(String(64), index=True)
    buyer_email: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | approved | rejected
    note: Mapped[str | None] = mapped_column(Text)  # buyer's note when requesting
    decision_note: Mapped[str | None] = mapped_column(Text)  # auditor's note when deciding
    decided_by: Mapped[str | None] = mapped_column(String(255))
    requested_at: Mapped[datetime] = mapped_column(default=utcnow)
    decided_at: Mapped[datetime | None]
