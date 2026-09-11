from typing import Literal

from pydantic import BaseModel, ConfigDict

RiskBand = Literal["low", "medium", "high", "critical"]
RecStatus = Literal["pending", "approved", "rejected", "reported"]
ActionType = Literal["approve", "reject", "report", "note"]
CheckStatus = Literal["pass", "warn", "fail"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
