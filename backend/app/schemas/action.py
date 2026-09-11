from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ActionType, ORMModel, RecStatus


class ActionCreate(BaseModel):
    action: ActionType
    auditor: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def require_note(self):
        if self.action != "approve" and not (self.note and self.note.strip()):
            raise ValueError(f"A note is required to {self.action} a REC.")
        return self


class AuditActionOut(ORMModel):
    id: int
    rec_id: str
    action: ActionType
    auditor: str
    note: str | None
    created_at: datetime


class ActionResult(BaseModel):
    action: AuditActionOut
    rec_status: RecStatus
    ledger_hash: str
