"""Historical daily solar irradiation from Open-Meteo (free, no API key)."""
from datetime import date

import httpx

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def daily_irradiation(latitude: float, longitude: float, start: date, end: date) -> dict[date, float]:
    """Daily irradiation in kWh/m² per day. Open-Meteo reports MJ/m², and 3.6 MJ = 1 kWh.

    The archive lags real time by a few days, so very recent dates may be missing from the result.
    Raises httpx.HTTPError on network or API failure.
    """
    response = httpx.get(
        ARCHIVE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": "shortwave_radiation_sum",
            "timezone": "auto",
        },
        timeout=15,
    )
    response.raise_for_status()
    daily = response.json()["daily"]
    return {
        date.fromisoformat(day): round(mj / 3.6, 3)
        for day, mj in zip(daily["time"], daily["shortwave_radiation_sum"])
        if mj is not None
    }
