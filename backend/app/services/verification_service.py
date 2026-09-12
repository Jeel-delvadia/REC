"""Runs every engine for one REC, scores the results, explains them, and records the outcome."""
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.engines import anomaly, duplicate, graph, ledger, physics
from app.integrations import open_meteo
from app.models import Generation, Plant, Rec, Transaction, VerificationResult
from app.services import alert_service, audit_service, explanation_service, risk_service
from app.services.rec_service import get_rec

log = logging.getLogger(__name__)

CHECK_LABELS = {
    "physics": "Physics plausibility",
    "meter_match": "Claim vs meter",
    "duplicate": "Double counting",
    "anomaly": "Meter anomalies",
    "provenance": "Transfer history",
}

_anomaly_model = None


def _get_anomaly_model():
    # Cached once found; retried while missing, so a model trained after startup is picked up.
    global _anomaly_model
    if _anomaly_model is None:
        _anomaly_model = anomaly.load_model(settings.ANOMALY_MODEL_PATH)
    return _anomaly_model


def verify_rec(db: Session, rec_id: str, *, use_llm: bool = True) -> VerificationResult:
    rec = get_rec(db, rec_id)
    plant = rec.plant
    readings = db.scalars(
        select(Generation)
        .where(Generation.plant_id == plant.id, Generation.day.between(rec.period_start, rec.period_end))
        .order_by(Generation.day)
    ).all()
    _fill_missing_irradiation(plant, readings)
    others = db.scalars(
        select(Rec).where(
            Rec.plant_id == plant.id,
            Rec.id != rec.id,
            Rec.period_start <= rec.period_end,
            Rec.period_end >= rec.period_start,
        )
    ).all()
    transfers = db.scalars(
        select(Transaction).where(Transaction.rec_id == rec.id).order_by(Transaction.timestamp)
    ).all()

    measurements = _measure(rec, plant, readings, others, transfers)
    risks = risk_service.check_risks(measurements)
    score = risk_service.score(risks)
    band = risk_service.band_for(score)
    checks = [
        {
            "name": name,
            "label": CHECK_LABELS[name],
            "status": risk_service.status_for(risks[name]),
            "risk": round(risks[name], 2),
            "weight": risk_service.WEIGHTS[name],
            "summary": _SUMMARIES[name](m),
            "reason_code": risk_service.check_reason(name, m),
            "details": m,
        }
        for name, m in measurements.items()
    ]

    # Ledger integrity is a gate, not a weighted check (report §6): a broken hash chain, or a
    # REC row that no longer matches its own ledger history, overrides the band to likely_fraud
    # whatever the weighted score says.
    ledger_check = _check_ledger(db, rec)
    checks.append(ledger_check)
    if ledger_check["status"] == "fail":
        band = risk_service.FRAUD_BAND

    rec_info = {
        "id": rec.id,
        "plant_name": plant.name,
        "capacity_kw": plant.capacity_kw,
        "period_start": rec.period_start,
        "period_end": rec.period_end,
        "energy_mwh": rec.energy_mwh,
    }
    explanation, source = explanation_service.explain(rec_info, score, band, checks, use_llm=use_llm)

    result = VerificationResult(
        rec_id=rec.id,
        risk_score=score,
        risk_band=band,
        checks=checks,
        explanation=explanation,
        explanation_source=source,
        created_at=utcnow(),
    )
    db.add(result)
    rec.risk_score, rec.risk_band, rec.verified_at = score, band, result.created_at
    audit_service.append_ledger(
        db,
        "VERIFIED",
        rec.id,
        {"risk_score": score, "risk_band": band, "checks": {c["name"]: c["status"] for c in checks}},
    )
    alert_service.raise_for_verification(db, rec, score, band, checks)
    if ledger_check["status"] == "fail":
        alert_service.raise_for_ledger_failure(db, rec, ledger_check["details"]["reason"])
    provenance = measurements["provenance"]
    if provenance["cycle"]:
        alert_service.raise_for_circular_transfer(db, rec, provenance["cycle_parties"])
    db.commit()
    db.refresh(result)
    return result


def _check_ledger(db: Session, rec: Rec) -> dict:
    """RS-07: chain-wide hash integrity, plus this REC's row against its own ledger history."""
    chain = audit_service.verify_ledger(db)
    rec_entries = [
        {"event_type": e.event_type, "payload": e.payload} for e in audit_service.history(db, rec.id)
    ]
    row = ledger.check_rec_integrity({"energy_mwh": rec.energy_mwh, "holder": rec.holder}, rec_entries)

    if not chain["valid"]:
        summary = f"Chain-wide hash mismatch at ledger entry #{chain['broken_at']}."
        status = "fail"
    elif not row["consistent"]:
        summary = f"This REC's row no longer matches its own ledger history: {row['reason']}."
        status = "fail"
    else:
        summary = f"{chain['entries_checked']} ledger entries verified; this REC's row matches its history."
        status = "pass"

    return {
        "name": "ledger",
        "label": "Ledger integrity",
        "status": status,
        "risk": 1.0 if status == "fail" else 0.0,
        "weight": 0,  # a gate, not part of the weighted score - see risk_service module docstring
        "summary": summary,
        "reason_code": "LEDGER_TAMPERED" if status == "fail" else "LEDGER_INTACT",
        "details": {"chain_valid": chain["valid"], "row_consistent": row["consistent"], "reason": row["reason"] or (None if chain["valid"] else f"broken at entry #{chain['broken_at']}")},
    }


def _measure(
    rec: Rec, plant: Plant, readings: list[Generation], others: list[Rec], transfers: list[Transaction]
) -> dict[str, dict]:
    # Physics and anomaly checks need sunlight data; days without it are left out of both.
    sunny = [(r.energy_kwh, r.irradiation_kwh_m2) for r in readings if r.irradiation_kwh_m2 is not None]
    sunny_kwh = [kwh for kwh, _ in sunny]
    sunny_irradiation = [sun for _, sun in sunny]

    claimed_kwh = rec.energy_mwh * 1000
    metered_kwh = sum(r.energy_kwh for r in readings)
    period_days = (rec.period_end - rec.period_start).days + 1
    other_claims = [
        {"rec_id": o.id, "start": o.period_start, "end": o.period_end, "energy_kwh": o.energy_mwh * 1000}
        for o in others
    ]
    chain = [
        {"from_party": t.from_party, "to_party": t.to_party, "timestamp": t.timestamp, "kind": t.kind}
        for t in transfers
    ]
    return {
        "physics": physics.assess(plant.capacity_kw, sunny_kwh, sunny_irradiation),
        "meter_match": duplicate.claim_vs_meter(claimed_kwh, metered_kwh, len(readings), period_days),
        "duplicate": duplicate.double_counting(
            claimed_kwh, metered_kwh, (rec.period_start, rec.period_end), other_claims
        ),
        "anomaly": anomaly.assess(
            _get_anomaly_model(), anomaly.build_features(plant.capacity_kw, sunny_kwh, sunny_irradiation)
        ),
        "provenance": graph.analyse_chain(chain),
    }


def _fill_missing_irradiation(plant: Plant, readings: list[Generation]) -> None:
    """Backfill sunlight data from Open-Meteo; saved with the verification commit."""
    missing = [r for r in readings if r.irradiation_kwh_m2 is None]
    if not missing:
        return
    try:
        daily = open_meteo.daily_irradiation(plant.latitude, plant.longitude, missing[0].day, missing[-1].day)
    except httpx.HTTPError as exc:
        log.warning("Open-Meteo lookup failed for %s: %s", plant.id, exc)
        return
    for reading in missing:
        reading.irradiation_kwh_m2 = daily.get(reading.day)


def _mwh(kwh: float) -> str:
    return f"{kwh / 1000:,.1f} MWh"


def _physics_summary(m: dict) -> str:
    if m["days"] == 0:
        return "No meter readings with matching sunlight data, so output can't be checked against physics."
    text = (
        f"Metered {_mwh(m['metered_kwh'])} against {_mwh(m['expected_kwh'])} that the recorded sunlight "
        f"could produce ({m['ratio']:.2f}x)"
    )
    if m["days_over_capacity"]:
        text += f"; {m['days_over_capacity']} day(s) exceed the plant's physical maximum"
    return text + "."


def _meter_match_summary(m: dict) -> str:
    if m["metered_kwh"] <= 0:
        return f"Claims {_mwh(m['claimed_kwh'])} but there are no meter readings for the period."
    return (
        f"Claims {_mwh(m['claimed_kwh'])} against {_mwh(m['metered_kwh'])} metered ({m['claim_ratio']:.2f}x), "
        f"from {m['meter_days']} of {m['period_days']} days of meter data."
    )


def _duplicate_summary(m: dict) -> str:
    if not m["overlapping_recs"]:
        return "No other REC claims this plant's generation for these dates."
    ids = ", ".join(o["rec_id"] for o in m["overlapping_recs"])
    return (
        f"{len(m['overlapping_recs'])} other REC(s) ({ids}) claim overlapping dates; together the claims are "
        f"{m['total_claim_ratio']:.2f}x the metered energy."
    )


def _anomaly_summary(m: dict) -> str:
    if not m["available"]:
        return "Anomaly model not trained yet (run python -m ml.train_anomaly)."
    return f"{m['anomalous_days']} of {m['days']} daily readings look unusual for a solar plant (Isolation Forest)."


def _provenance_summary(m: dict) -> str:
    parts = [f"{m['transfers']} transfer(s)"]
    if m["cycle"]:
        parts.append(f"ownership loops back through {', '.join(m['cycle_parties'])}")
    if m["rapid_resales"]:
        parts.append(f"{m['rapid_resales']} resale(s) within {graph.RAPID_RESALE_HOURS} h")
    if len(parts) == 1:
        parts.append("no circular or rapid trading")
    return "; ".join(parts) + "."


_SUMMARIES = {
    "physics": _physics_summary,
    "meter_match": _meter_match_summary,
    "duplicate": _duplicate_summary,
    "anomaly": _anomaly_summary,
    "provenance": _provenance_summary,
}
