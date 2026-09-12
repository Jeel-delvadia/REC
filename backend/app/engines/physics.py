"""Physics plausibility: could this plant really have produced the metered energy?

Pure functions: numbers in, numbers out. No database, no HTTP.

Uses pvlib's own PVWatts loss model (report §5/§14: "pvlib ... PVWatts-style estimate from
plant capacity and assumed system losses") rather than an arbitrary derate constant. Scope
note: this still runs on the daily insolation total each Generation row carries (irradiation
kWh/m2 for that day), the same "peak sun hours x capacity" method PVWatts itself uses at its
core. Full hourly solar-position modelling (pvlib.solarposition + pvlib.irradiance) needs
hourly GHI/DNI/DHI and a panel tilt/azimuth, which the schema doesn't carry yet (RS-02 adds
meters and intervals, not hourly readings) - once RS-03 produces hourly Generation rows, this
function's contract (capacity, one irradiation figure, one energy figure) is unchanged; only
the caller's bucket size (hour instead of day) needs to change.
"""
import pvlib.pvsystem as pvsystem

# NREL's own PVWatts defaults (soiling, shading, wiring, LID, availability, ...) - see
# pvlib.pvsystem.pvwatts_losses() for the full breakdown. ~14.08% at these defaults.
SYSTEM_LOSS_PCT = pvsystem.pvwatts_losses()
# pvlib.inverter.pvwatts's own default nominal efficiency (eta_inv_nom) - applied separately
# rather than through inverter.pvwatts() itself, which expects instantaneous power, not a
# daily energy total, and would silently mis-clip a full day's insolation as if it were one instant.
INVERTER_EFFICIENCY = 0.96
DEFAULT_PERFORMANCE_RATIO = (1 - SYSTEM_LOSS_PCT / 100) * INVERTER_EFFICIENCY

# Highest daily capacity factor a fixed PV plant reaches, even on a perfect day.
MAX_DAILY_CAPACITY_FACTOR = 0.30
# Ratio reported when energy was metered but the sunlight data says none was possible.
NO_BASELINE = 99.0


def expected_daily_kwh(
    capacity_kw: float, irradiation_kwh_m2: float, performance_ratio: float = DEFAULT_PERFORMANCE_RATIO
) -> float:
    """Panels are rated at 1 kW/m² (STC), so each kWh/m² of sunlight is one hour at full rated
    output - the same insolation method PVWatts itself uses, before its system-loss derate."""
    return capacity_kw * irradiation_kwh_m2 * performance_ratio


def max_daily_kwh(capacity_kw: float) -> float:
    return capacity_kw * 24 * MAX_DAILY_CAPACITY_FACTOR


def assess(
    capacity_kw: float,
    metered_kwh: list[float],
    irradiation: list[float],
    performance_ratio: float = DEFAULT_PERFORMANCE_RATIO,
) -> dict:
    """Compare metered energy with what the recorded sunlight could produce. Lists are aligned by day."""
    expected = sum(expected_daily_kwh(capacity_kw, sun, performance_ratio) for sun in irradiation)
    metered = sum(metered_kwh)
    if expected > 0:
        ratio = round(metered / expected, 3)
    else:
        ratio = 0.0 if metered <= 0 else NO_BASELINE
    ceiling = max_daily_kwh(capacity_kw)
    return {
        "days": len(metered_kwh),
        "metered_kwh": round(metered, 1),
        "expected_kwh": round(expected, 1),
        "ratio": ratio,
        "days_over_capacity": sum(1 for kwh in metered_kwh if kwh > ceiling),
        "performance_ratio": round(performance_ratio, 4),
    }


def assess_claim(
    capacity_kw: float,
    claimed_kwh: float,
    interval_hours: float,
    irradiation_kwh_m2: float,
    performance_ratio: float = DEFAULT_PERFORMANCE_RATIO,
) -> dict:
    """Report §5 worked example: one claim over one interval, checked against both the physics
    estimate and the plant's hard capacity ceiling (capacity x hours) - the two-part physics
    check ("physically impossible" vs "fails physics check") shown in that table.
    """
    expected = expected_daily_kwh(capacity_kw, irradiation_kwh_m2, performance_ratio)
    ceiling = capacity_kw * interval_hours
    return {
        "claimed_kwh": round(claimed_kwh, 1),
        "expected_kwh": round(expected, 1),
        "ceiling_kwh": round(ceiling, 1),
        "ratio_to_expected": ratio_or_baseline(claimed_kwh, expected),
        "exceeds_ceiling": claimed_kwh > ceiling,
    }


def ratio_or_baseline(claimed: float, baseline: float) -> float:
    if baseline > 0:
        return round(claimed / baseline, 3)
    return 0.0 if claimed <= 0 else NO_BASELINE
