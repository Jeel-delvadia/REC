from pydantic import BaseModel

from app.schemas.rec import RecSummary


class DashboardStats(BaseModel):
    total_recs: int
    total_mwh: float
    verified: int
    high_risk: int
    pending_review: int
    open_alerts: int


class DashboardSummary(BaseModel):
    stats: DashboardStats
    high_risk: list[RecSummary]
