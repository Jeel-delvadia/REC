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
    # RS-19: the certificate metadata a real REC carries (Issuing Authority, REC Type, etc.) -
    # public precisely because these are the facts a verifier scanning the QR code wants to see.
    rec_type: str | None
    issuing_authority: str | None
    generation_date: date | None
    rec_issued: int
    certificate_status: str


class ReportOut(BaseModel):
    generated_at: datetime
    public_url: str
    rec: RecDetail
    history: list[LedgerEntryOut]
    ledger: LedgerVerifyOut
