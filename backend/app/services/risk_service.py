"""Risk scoring. Every threshold lives here: engines measure, this module judges.

The API returns score and band together, and the frontend only maps band -> colour,
so the dashboard and the backend can never disagree about what counts as high risk.
"""

# Score -> band, checked top-down.
BANDS = ((80, "critical"), (60, "high"), (40, "medium"), (0, "low"))
HIGH_RISK_BANDS = ("high", "critical")

# How many of the 100 points each check can contribute.
WEIGHTS = {"physics": 30, "meter_match": 25, "duplicate": 25, "anomaly": 10, "provenance": 10}

# A near-certain failure on any of these is enough on its own to make a REC high risk.
HARD_FAIL_CHECKS = ("physics", "meter_match", "duplicate")
HARD_FAIL_RISK = 0.9
HARD_FAIL_FLOOR = 65

# Per-check status shown next to each check.
FAIL_AT = 0.6
WARN_AT = 0.2


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
    if not m["overlapping_recs"]:
        return 0.0
    return max(0.6, _ramp(m["total_claim_ratio"], 1.0, 1.5))


def _anomaly(m: dict) -> float:
    return _ramp(m["fraction"], 0.05, 0.30) if m["available"] else 0.0


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


def check_risks(measurements: dict[str, dict]) -> dict[str, float]:
    """Engine measurements -> 0-1 risk per check."""
    return {name: _RISK_FUNCTIONS[name](m) for name, m in measurements.items()}


def score(risks: dict[str, float]) -> int:
    total = sum(WEIGHTS[name] * risk for name, risk in risks.items())
    if any(risks.get(name, 0.0) >= HARD_FAIL_RISK for name in HARD_FAIL_CHECKS):
        total = max(total, HARD_FAIL_FLOOR)
    return round(min(total, 100))


def band_for(score: int) -> str:
    for floor, band in BANDS:
        if score >= floor:
            return band
    return "low"


def status_for(risk: float) -> str:
    if risk >= FAIL_AT:
        return "fail"
    if risk >= WARN_AT:
        return "warn"
    return "pass"
