"""Physics plausibility: could this plant really have produced the metered energy?

Pure functions: numbers in, numbers out. No database, no HTTP.
"""

# Share of rated output a PV plant actually delivers after inverter, heat and soiling losses.
DEFAULT_PERFORMANCE_RATIO = 0.80
# Highest daily capacity factor a fixed PV plant reaches, even on a perfect day.
MAX_DAILY_CAPACITY_FACTOR = 0.30
# Ratio reported when energy was metered but the sunlight data says none was possible.
NO_BASELINE = 99.0


def expected_daily_kwh(
    capacity_kw: float, irradiation_kwh_m2: float, performance_ratio: float = DEFAULT_PERFORMANCE_RATIO
) -> float:
    """Panels are rated at 1 kW/m², so each kWh/m² of sunlight is one hour at full rated output."""
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
    }
