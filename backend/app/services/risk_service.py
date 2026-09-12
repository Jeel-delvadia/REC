"""Risk scoring. Every threshold lives here: engines measure, this module judges.

Weights, bands and thresholds follow the hackathon report (§6). The API returns score
and band together, and the frontend only maps band -> colour, so the dashboard and the
backend can never disagree about what counts as high risk.

Ledger integrity is deliberately not one of the weighted checks below - a broken hash
chain overrides the band to likely_fraud regardless of score. See RS-07 in
verification_service.py.
"""

# Score -> band, checked top-down. Report §6.
BANDS = ((81, "likely_fraud"), (61, "high_risk"), (31, "suspicious"), (0, "genuine"))
GENUINE_BAND = "genuine"
SUSPICIOUS_BANDS = ("suspicious", "high_risk")
FRAUD_BAND = "likely_fraud"
# Kept for the dashboard's existing "at risk" count; alerts key off FRAUD_BAND alone (RS-09).
HIGH_RISK_BANDS = SUSPICIOUS_BANDS + (FRAUD_BAND,)

# How many of the 100 points each check can contribute. Report §6 Fraud Risk Score table.
WEIGHTS = {"physics": 30, "meter_match": 25, "duplicate": 25, "anomaly": 15, "provenance": 5}

# Per-check status shown next to each check (report §6: below 40 pass, 40-79 warn, 80+ fail),
# expressed here on the 0-1 risk scale used internally (risk * 100 = the report's sub-score).
FAIL_AT = 0.8
WARN_AT = 0.4


def _ramp(value: float, start: float, full: float) -> float:
    """0 at or below `start`, 1 at or above `full`, linear in between."""
    if value <= start:
        return 0.0
    if value >= full:
        return 1.0
    return (value - start) / (full - start)


def _physics(m: dict) -> float:
    if m["days"] == 0:
        return 0.5  # nothing to compare against: unverifiable, not clean
    over_capacity = 1.0 if m["days_over_capacity"] else 0.0
    return max(_ramp(m["ratio"], 1.10, 1.40), over_capacity)


def _meter_match(m: dict) -> float:
    return _ramp(m["claim_ratio"], 1.01, 1.20)


def _duplicate(m: dict) -> float:
    if m.get("fingerprint_matches"):
        return 1.0  # report §7: an exact fingerprint match is DOUBLE COUNTING DETECTED, full stop
    if not m["overlapping_recs"]:
        return 0.0
    return max(0.6, _ramp(m["total_claim_ratio"], 1.0, 1.5))


def _anomaly(m: dict) -> float:
    if not m["available"]:
        return 0.0
    return 1.0 if m["is_anomalous"] else _ramp(m["anomaly_score"], 0.5, 0.85)


def _provenance(m: dict) -> float:
    return max(
        1.0 if m["cycle"] else 0.0,
        0.7 * _ramp(m["rapid_resales"], 0, 3),
        0.5 * _ramp(m["transfers"], 3, 8),
    )


_RISK_FUNCTIONS = {
    "physics": _physics,
    "meter_match": _meter_match,
    "duplicate": _duplicate,
    "anomaly": _anomaly,
    "provenance": _provenance,
}


def _physics_reason(m: dict) -> str:
    if m["days"] == 0:
        return "PHYSICS_NO_DATA"
    if m["days_over_capacity"]:
        return "PHYSICS_EXCEEDS_CAPACITY"
    if m["ratio"] > 1.10:
        return "PHYSICS_CLAIM_ABOVE_ESTIMATE"
    return "PHYSICS_WITHIN_TOLERANCE"


def _meter_match_reason(m: dict) -> str:
    if m["metered_kwh"] <= 0:
        return "METER_NO_DATA"
    if m["claim_ratio"] > 1.01:
        return "METER_CLAIM_ABOVE_METERED"
    return "METER_CONSISTENT"


def _duplicate_reason(m: dict) -> str:
    if m.get("fingerprint_matches"):
        return "DUPLICATE_FINGERPRINT_MATCH"
    return "DUPLICATE_OVERLAPPING_CLAIM" if m["overlapping_recs"] else "DUPLICATE_NONE_FOUND"


def _anomaly_reason(m: dict) -> str:
    if not m["available"]:
        return "ANOMALY_MODEL_UNAVAILABLE"
    return "ANOMALY_UNUSUAL_PATTERN" if m["is_anomalous"] else "ANOMALY_NORMAL_PATTERN"


def _provenance_reason(m: dict) -> str:
    if m["cycle"]:
        return "PROVENANCE_CIRCULAR_TRANSFER"
    if m["rapid_resales"]:
        return "PROVENANCE_RAPID_RESALE"
    return "PROVENANCE_CLEAN"


_REASON_FUNCTIONS = {
    "physics": _physics_reason,
    "meter_match": _meter_match_reason,
    "duplicate": _duplicate_reason,
    "anomaly": _anomaly_reason,
    "provenance": _provenance_reason,
}


def check_risks(measurements: dict[str, dict]) -> dict[str, float]:
    """Engine measurements -> 0-1 risk per check."""
    return {name: _RISK_FUNCTIONS[name](m) for name, m in measurements.items()}


def check_reason(name: str, m: dict) -> str:
    """A short reason code carrying the same numbers as the check's summary text (report §9)."""
    return _REASON_FUNCTIONS[name](m)


def score(risks: dict[str, float]) -> int:
    total = sum(WEIGHTS[name] * risk for name, risk in risks.items())
    return round(min(total, 100))


def band_for(score: int) -> str:
    for floor, band in BANDS:
        if score >= floor:
            return band
    return GENUINE_BAND


def status_for(risk: float) -> str:
    if risk >= FAIL_AT:
        return "fail"
    if risk >= WARN_AT:
        return "warn"
    return "pass"
