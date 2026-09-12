from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel, RiskBand


class MarketplaceListingOut(ORMModel):
    """RS-24: a REC available for a buyer to request - unclaimed, not rejected/reported,
    still active. Slimmer than RecSummary since a buyer browsing doesn't need every internal
    field, just enough to judge whether they want it."""
    id: str
    plant_id: str
    plant_name: str
    energy_mwh: float
    period_start: date
    period_end: date
    holder: str
    risk_score: int | None
    risk_band: RiskBand | None


class PurchaseRequestCreate(BaseModel):
    note: str | None = None


class PurchaseRequestDecision(BaseModel):
    note: str | None = None


class PurchaseRequestOut(ORMModel):
    id: int
    rec_id: str
    buyer_email: str
    status: str
    note: str | None
    decision_note: str | None
    decided_by: str | None
    requested_at: datetime
    decided_at: datetime | None
