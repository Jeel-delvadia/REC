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
    location: str | None = None


class PlantCreate(BaseModel):
    """RS-19: registers a new generator/project on the fly instead of requiring a CSV
    pre-seed via the Data Hub - the Upload modal's '+ Add New Plant' step posts this."""
    name: str
    owner: str
    capacity_kw: float
    technology: str = "solar"
    location: str | None = None
    # Optional: the physics-plausibility check needs real coordinates to fetch irradiation from
    # Open-Meteo, but a first-time user often only knows a state/city. When omitted, the service
    # tries to resolve a rough centroid from `location` text (see rec_service.STATE_CENTROIDS);
    # if that also fails, it falls back to India's geographic center with a caveat in the response.
    latitude: float | None = None
    longitude: float | None = None
    commissioned_on: date | None = None


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
    # RS-19: real-certificate fields (see report). All optional - rec_service fills sensible
    # defaults (rec_type from the plant's technology, issuing_authority from settings,
    # generation_date from period_start) so older callers/tests that don't send them still work.
    rec_type: str | None = None
    issuing_authority: str | None = None
    generation_date: date | None = None
    rec_issued: int = 1



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
    rec_type: str | None = None
    issuing_authority: str | None = None
    generation_date: date | None = None
    rec_issued: int = 1
    certificate_status: str = "active"


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
    # RS-23: the buyer account (if any) this REC is linked to - separate from `holder`, the
    # free-text display name. None until an auditor/admin assigns it via POST .../buyer.
    buyer_email: str | None = None


class BuyerAssign(BaseModel):
    buyer_email: str
