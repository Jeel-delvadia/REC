from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import ORMModel


class LedgerEntryOut(ORMModel):
    id: int
    rec_id: str | None
    event_type: str
    payload: dict[str, Any]
    prev_hash: str
    hash: str
    created_at: datetime


class LedgerVerifyOut(BaseModel):
    valid: bool
    entries_checked: int
    broken_at: int | None  # id of the first entry whose hash doesn't match
    head_hash: str | None
