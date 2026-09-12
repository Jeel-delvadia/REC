from datetime import datetime
from typing import Literal

from app.schemas.common import ORMModel


class DataQualityIssueOut(ORMModel):
    rule: str
    file: str
    severity: Literal["info", "warn", "fail"]
    message: str
    count: int


class DataQualityReportOut(ORMModel):
    id: int
    source: str
    score: int
    issues: list[DataQualityIssueOut]
    created_at: datetime
