from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Transaction(Base):
    """One step in a REC's ownership chain: issued by the registry, then transferred between parties."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    rec_id: Mapped[str] = mapped_column(ForeignKey("recs.id"), index=True)
    from_party: Mapped[str] = mapped_column(String(120))
    to_party: Mapped[str] = mapped_column(String(120))
    timestamp: Mapped[datetime]
    kind: Mapped[str] = mapped_column(String(16), default="transfer")  # issue | transfer
