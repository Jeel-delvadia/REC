"""Batch/aggregate data-quality checks - the things Pydantic's per-row validators in
app/schemas/ingest_rows.py structurally cannot express, since a Pydantic model only ever sees
one row in isolation. This engine looks across rows instead:

- duplicate IDs *within* a batch (two rows claiming the same plant/REC ID)
- dangling references (a row pointing at a plant/meter/REC that doesn't exist in this batch)
- statistical outliers (a reading far from that plant's own batch mean - needs every row for
  that plant to compute, not just the one being checked)
- completeness (what fraction of optional-but-expected fields actually got populated)
- freshness (how stale the newest data is)

report §9.6 explains why this is a separate module rather than folded into Pydantic: those are
genuinely different jobs (shape/range validation on one row vs statistical/relational checks
across many), and cramming the second into the first would mean re-reading every row a second
time inside a validator that was never meant to hold state across rows.

Pure functions: lists/dicts in, an issue list out. No database, no HTTP.
"""
from datetime import date
from statistics import median
from typing import Literal

Severity = Literal["info", "warn", "fail"]

# How many standard deviations from a plant's own batch mean before a reading is an outlier.
OUTLIER_STD_DEVS = 3.0
# A plant needs at least this many readings in the batch before "its own mean" means anything.
MIN_READINGS_FOR_BASELINE = 5
# How old the newest generation reading can be before freshness is flagged.
FRESHNESS_WARN_DAYS = 30

# Score deducted per issue found, by severity - mirrors risk_service's "one place, no
# duplication" rule: every point value used to compute the 0-100 score lives here.
SEVERITY_PENALTY: dict[Severity, int] = {"fail": 20, "warn": 8, "info": 2}


def check_duplicate_ids(file_name: str, ids: list[str]) -> dict | None:
    seen: set[str] = set()
    dupes: set[str] = set()
    for i in ids:
        if i in seen:
            dupes.add(i)
        seen.add(i)
    if not dupes:
        return None
    shown = ", ".join(sorted(dupes)[:5]) + ("..." if len(dupes) > 5 else "")
    return {
        "rule": "duplicate_ids",
        "file": file_name,
        "severity": "fail",
        "message": f"{len(dupes)} duplicate ID(s) in {file_name}: {shown}",
        "count": len(dupes),
    }


def check_dangling_references(file_name: str, field: str, values: list[str], known: set[str]) -> dict | None:
    dangling = sorted({v for v in values if v not in known})
    if not dangling:
        return None
    shown = ", ".join(dangling[:5]) + ("..." if len(dangling) > 5 else "")
    return {
        "rule": "dangling_reference",
        "file": file_name,
        "severity": "fail",
        "message": f"{len(dangling)} row(s) in {file_name} reference an unknown {field}: {shown}",
        "count": len(dangling),
    }


def check_statistical_outliers(plant_energy: dict[str, list[float]], std_devs: float = OUTLIER_STD_DEVS) -> dict | None:
    """plant_energy: {plant_id: [energy_kwh, ...]} - every generation reading for that plant
    in this batch. A plant with too few readings has no meaningful baseline yet, so it's
    skipped rather than false-flagged.

    Uses median + MAD (median absolute deviation), not mean + standard deviation: a plain
    stdev is itself dragged upward by the very outlier it's supposed to catch (one 50x spike
    among five normal readings inflates the stdev enough to mask itself), while the median is
    unmoved by a single extreme value. 1.4826 * MAD approximates a normal distribution's
    stdev, so `std_devs` still reads the same way as an ordinary sigma threshold.
    """
    outlier_count = 0
    examples: list[str] = []
    for plant_id, values in plant_energy.items():
        if len(values) < MIN_READINGS_FOR_BASELINE:
            continue
        m = median(values)
        mad = median([abs(v - m) for v in values])
        robust_sigma = mad * 1.4826
        if robust_sigma == 0:
            continue
        for v in values:
            if abs(v - m) > std_devs * robust_sigma:
                outlier_count += 1
                if len(examples) < 5:
                    examples.append(f"{plant_id}: {v:.0f} kWh (plant's own batch median {m:.0f})")
    if not outlier_count:
        return None
    return {
        "rule": "statistical_outlier",
        "file": "generation.csv",
        "severity": "warn",
        "message": f"{outlier_count} reading(s) far outside their plant's own batch distribution: " + "; ".join(examples),
        "count": outlier_count,
    }


def check_completeness(file_name: str, total_rows: int, missing_counts: dict[str, int]) -> dict | None:
    """missing_counts: {field_name: how many rows left it empty}, for fields that are optional
    in the schema but expected in practice (e.g. irradiation_kwh_m2, commissioned_on)."""
    if total_rows == 0:
        return None
    parts = [f"{field}: {total_rows - missing}/{total_rows} populated" for field, missing in missing_counts.items() if missing > 0]
    if not parts:
        return None
    overall_missing_ratio = sum(missing_counts.values()) / (total_rows * len(missing_counts))
    severity: Severity = "warn" if overall_missing_ratio > 0.2 else "info"
    return {
        "rule": "completeness",
        "file": file_name,
        "severity": severity,
        "message": f"Optional field completeness in {file_name} - " + "; ".join(parts),
        "count": sum(missing_counts.values()),
    }


def check_freshness(latest_date: date | None, today: date, warn_after_days: int = FRESHNESS_WARN_DAYS) -> dict | None:
    if latest_date is None:
        return None
    age_days = (today - latest_date).days
    if age_days <= warn_after_days:
        return None
    return {
        "rule": "freshness",
        "file": "generation.csv",
        "severity": "warn",
        "message": f"Newest generation reading is {age_days} day(s) old as of {today} (latest reading: {latest_date}).",
        "count": age_days,
    }


def score(issues: list[dict]) -> int:
    """0-100, same shape as risk_service's score so the two feel like one family in the UI -
    100 means nothing to report, not "no risk of fraud" (a different axis entirely)."""
    penalty = sum(SEVERITY_PENALTY.get(issue["severity"], 0) for issue in issues)
    return max(0, 100 - penalty)


def run(issues: list[dict | None]) -> dict:
    """Drop the None results from the individual checks and score what's left."""
    found = [i for i in issues if i is not None]
    return {"score": score(found), "issues": found}
