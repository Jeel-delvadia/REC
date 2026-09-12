"""Row-level validation for the ingest CSVs (RS-10). Bad rows are skipped, not fatal -
one malformed line in generation.csv shouldn't sink the whole batch."""
from datetime import date, datetime

from pydantic import BaseModel, field_validator, model_validator


class PlantRow(BaseModel):
    id: str
    name: str
    owner: str
    latitude: float
    longitude: float
    capacity_kw: float
    technology: str
    commissioned_on: date | None = None

    @field_validator("latitude")
    @classmethod
    def _lat_range(cls, v):
        if not -90 <= v <= 90:
            raise ValueError(f"latitude {v} out of range")
        return v

    @field_validator("longitude")
    @classmethod
    def _lon_range(cls, v):
        if not -180 <= v <= 180:
            raise ValueError(f"longitude {v} out of range")
        return v

    @field_validator("capacity_kw")
    @classmethod
    def _capacity_positive(cls, v):
        if v <= 0:
            raise ValueError(f"capacity_kw must be positive, got {v}")
        return v


class MeterRow(BaseModel):
    id: str
    plant_id: str


class GenerationRow(BaseModel):
    plant_id: str
    meter_id: str | None = None  # RS-02: filled in from meters.csv, or a per-plant default, if absent
    day: date
    energy_kwh: float
    irradiation_kwh_m2: float | None = None

    @field_validator("energy_kwh")
    @classmethod
    def _energy_non_negative(cls, v):
        if v < 0:
            raise ValueError(f"energy_kwh cannot be negative, got {v}")
        return v

    @field_validator("irradiation_kwh_m2")
    @classmethod
    def _irradiation_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError(f"irradiation_kwh_m2 cannot be negative, got {v}")
        return v


class RecRow(BaseModel):
    id: str
    plant_id: str
    period_start: date
    period_end: date
    energy_mwh: float
    issued_at: datetime
    holder: str
    meter_id: str | None = None
    interval_start: datetime | None = None
    interval_end: datetime | None = None
    issuer: str | None = None

    @field_validator("energy_mwh")
    @classmethod
    def _energy_positive(cls, v):
        if v <= 0:
            raise ValueError(f"energy_mwh must be positive, got {v}")
        return v

    @field_validator("holder")
    @classmethod
    def _holder_not_blank(cls, v):
        if not v.strip():
            raise ValueError("holder cannot be blank")
        return v

    @model_validator(mode="after")
    def _period_ordered(self):
        if self.period_start > self.period_end:
            raise ValueError(f"period_start {self.period_start} is after period_end {self.period_end}")
        return self


class TransactionRow(BaseModel):
    rec_id: str
    from_party: str
    to_party: str
    timestamp: datetime
    kind: str

    @field_validator("kind")
    @classmethod
    def _kind_known(cls, v):
        if v not in ("issue", "transfer"):
            raise ValueError(f"kind must be 'issue' or 'transfer', got {v!r}")
        return v
