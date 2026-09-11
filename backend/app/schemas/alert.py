from datetime import datetime

from app.schemas.common import ORMModel, RiskBand


class AlertOut(ORMModel):
    id: int
    rec_id: str
    severity: RiskBand
    title: str
    message: str
    created_at: datetime
    acknowledged: bool
