from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Rec
from app.services import alert_service
from app.services.rec_service import summarize, visible_to_clause
from app.services.risk_service import HIGH_RISK_BANDS

HIGH_RISK_LIST_SIZE = 10


def summary(db: Session, viewer=None) -> dict:
    # RS-21 (§9.5): a plant_operator's or buyer's dashboard only ever reflects their own
    # plant/held RECs - reuses rec_service's own scoping rule so "who sees what" stays defined
    # in exactly one place rather than drifting between the REC list and the dashboard.
    scope = visible_to_clause(viewer) or ()

    def count(*conditions) -> int:
        return db.scalar(select(func.count()).select_from(Rec).where(*scope, *conditions))

    total_recs, total_mwh = db.execute(
        select(func.count(Rec.id), func.coalesce(func.sum(Rec.energy_mwh), 0.0)).where(*scope)
    ).one()

    high_risk = db.scalars(
        select(Rec)
        .where(*scope, Rec.risk_band.in_(HIGH_RISK_BANDS))
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
