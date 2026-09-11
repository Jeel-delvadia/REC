from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Rec
from app.services import alert_service
from app.services.rec_service import summarize
from app.services.risk_service import HIGH_RISK_BANDS

HIGH_RISK_LIST_SIZE = 10


def summary(db: Session) -> dict:
    total_recs, total_mwh = db.execute(
        select(func.count(Rec.id), func.coalesce(func.sum(Rec.energy_mwh), 0.0))
    ).one()

    def count(*conditions) -> int:
        return db.scalar(select(func.count()).select_from(Rec).where(*conditions))

    high_risk = db.scalars(
        select(Rec)
        .where(Rec.risk_band.in_(HIGH_RISK_BANDS))
        .order_by(Rec.risk_score.desc(), Rec.id)
        .limit(HIGH_RISK_LIST_SIZE)
    ).all()

    return {
        "stats": {
            "total_recs": total_recs,
            "total_mwh": round(float(total_mwh), 1),
            "verified": count(Rec.risk_score.is_not(None)),
            "high_risk": count(Rec.risk_band.in_(HIGH_RISK_BANDS)),
            "pending_review": count(Rec.status == "pending"),
            "open_alerts": alert_service.count_open(db),
        },
        "high_risk": [summarize(rec) for rec in high_risk],
    }
