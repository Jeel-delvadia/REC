"""Double-counting checks: is the same generation claimed more than once, or more than was metered?

Pure functions: numbers in, numbers out. No database, no HTTP.
"""
import hashlib
from datetime import date, datetime

# Ratio reported when energy is claimed but nothing was metered.
NO_BASELINE = 99.0


def fingerprint(plant_id: str, meter_id: str, interval_start, interval_end, energy_mwh: float) -> str:
    """Report §7: SHA-256(plant_id | meter_id | interval_start | interval_end | quantity_MWh).

    `interval_start`/`interval_end` take a date or a datetime - whichever precision the REC
    was issued with. isoformat() differs between the two (no time part on a bare date), which
    is fine: it only matters that the same event always hashes to the same fingerprint.
    Quantity is formatted to a fixed 3 decimal places so 180.0 and 180 never hash differently.
    """
    body = "|".join([plant_id, meter_id, interval_start.isoformat(), interval_end.isoformat(), f"{energy_mwh:.3f}"])
    return hashlib.sha256(body.encode()).hexdigest()


def ratio(claimed: float, metered: float) -> float:
    if metered > 0:
        return round(claimed / metered, 3)
    return 0.0 if claimed <= 0 else NO_BASELINE


def overlap_days(a_start: date, a_end: date, b_start: date, b_end: date) -> int:
    return max(0, (min(a_end, b_end) - max(a_start, b_start)).days + 1)


def claim_vs_meter(claimed_kwh: float, metered_kwh: float, meter_days: int, period_days: int) -> dict:
    return {
        "claimed_kwh": round(claimed_kwh, 1),
        "metered_kwh": round(metered_kwh, 1),
        "claim_ratio": ratio(claimed_kwh, metered_kwh),
        "meter_days": meter_days,
        "period_days": period_days,
    }


def double_counting(
    claimed_kwh: float,
    metered_kwh: float,
    period: tuple[date, date],
    other_claims: list[dict],
    fingerprint_matches: list[str] | None = None,
) -> dict:
    """`other_claims` are other RECs from the same plant: {"rec_id", "start", "end", "energy_kwh"}.
    `fingerprint_matches` (report §7): REC IDs whose fingerprint is identical to this REC's -
    the same generation event, re-certified under a new ID. A hash match is a stronger, exact
    signal than the day-overlap heuristic below, which also catches a changed quantity that
    would otherwise hash differently.

    Each overlapping claim counts in proportion to the days it shares with this period.
    """
    start, end = period
    overlapping, overlap_kwh = [], 0.0
    for claim in other_claims:
        days = overlap_days(start, end, claim["start"], claim["end"])
        if days:
            overlapping.append({"rec_id": claim["rec_id"], "overlap_days": days})
            overlap_kwh += claim["energy_kwh"] * days / ((claim["end"] - claim["start"]).days + 1)
    total = claimed_kwh + overlap_kwh
    return {
        "overlapping_recs": overlapping,
        "total_claimed_kwh": round(total, 1),
        "total_claim_ratio": ratio(total, metered_kwh),
        "fingerprint_matches": fingerprint_matches or [],
    }
