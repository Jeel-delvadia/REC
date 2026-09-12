from typing import Literal

from pydantic import BaseModel, ConfigDict

# genuine 0-30, suspicious 31-60, high_risk 61-80, likely_fraud 81-100 (report §6).
RiskBand = Literal["genuine", "suspicious", "high_risk", "likely_fraud"]
RecStatus = Literal["pending", "approved", "rejected", "reported"]
ActionType = Literal["approve", "reject", "report", "note", "request_verification"]
CheckStatus = Literal["pass", "warn", "fail"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
