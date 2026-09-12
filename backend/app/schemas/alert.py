from datetime import datetime

from app.schemas.common import AlertSeverity, ORMModel


class AlertOut(ORMModel):
    id: int
    rec_id: str
    severity: AlertSeverity
    title: str
    message: str
    created_at: datetime
    acknowledged: bool
