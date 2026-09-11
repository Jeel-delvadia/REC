from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import RecStatus, RiskBand
from app.schemas.ledger import LedgerEntryOut, LedgerVerifyOut
from app.schemas.rec import RecDetail


class PublicVerification(BaseModel):
    """What anyone scanning the QR code may see: no auditor notes, no internal check details."""

    rec_id: str
    plant_name: str
    plant_location: str
    capacity_kw: float
    energy_mwh: float
    period_start: date
    period_end: date
    status: RecStatus
    risk_score: int | None
    risk_band: RiskBand | None
    verified_at: datetime | None
    ledger_hash: str | None
    ledger_valid: bool
    verify_url: str


class ReportOut(BaseModel):
    generated_at: datetime
    public_url: str
    rec: RecDetail
    history: list[LedgerEntryOut]
    ledger: LedgerVerifyOut
