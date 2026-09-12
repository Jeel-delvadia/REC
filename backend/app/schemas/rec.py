from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.action import AuditActionOut
from app.schemas.common import CheckStatus, ORMModel, RecStatus, RiskBand


class PlantOut(ORMModel):
    id: str
    name: str
    owner: str
    latitude: float
    longitude: float
    capacity_kw: float
    technology: str


class RecCreate(BaseModel):
    id: str | None = None
    plant_id: str
    period_start: date
    period_end: date
    energy_mwh: float
    holder: str
    # RS-02: optional for now (a plant's default meter is used when omitted) - RS-05's
    # fingerprint check needs meter_id + interval to identify a generation event uniquely.
    meter_id: str | None = None
    interval_start: datetime | None = None
    interval_end: datetime | None = None
    issuer: str | None = None



class RecSummary(ORMModel):
    id: str
    plant_id: str
    plant_name: str
    period_start: date
    period_end: date
    energy_mwh: float
    holder: str
    status: RecStatus
    risk_score: int | None
    risk_band: RiskBand | None


class RecPage(BaseModel):
    items: list[RecSummary]
    total: int


class CheckOut(BaseModel):
    name: str
    label: str
    status: CheckStatus
    risk: float  # 0-1, from risk_service
    weight: int  # points this check can contribute to the 0-100 score; 0 for a gate check
    summary: str
    reason_code: str  # e.g. PHYSICS_CLAIM_ABOVE_ESTIMATE - the machine-readable half of summary
    details: dict[str, Any]


class VerificationOut(ORMModel):
    id: int
    rec_id: str
    risk_score: int
    risk_band: RiskBand
    checks: list[CheckOut]
    explanation: str
    explanation_source: str
    created_at: datetime


class RecDetail(RecSummary):
    issued_at: datetime
    verified_at: datetime | None
    plant: PlantOut
    verification: VerificationOut | None
    actions: list[AuditActionOut]
    meter_id: str | None = None
    interval_start: datetime | None = None
    interval_end: datetime | None = None
    issuer: str | None = None
    fingerprint: str | None = None
