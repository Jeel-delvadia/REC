"""Generate simulated plants, meter readings, RECs and transfers, train the anomaly model,
then load everything through POST /api/v1/ingest.

Run from backend/ with the API running:
    python -m scripts.seed_data                        # write CSVs, train model, call /ingest
    python -m scripts.seed_data --no-post               # write CSVs and train model only
    python -m scripts.seed_data --fraud rec00421        # only that one scenario, everything else clean
    python -m scripts.seed_data --fraud none            # a clean baseline dataset, no planted fraud

Planted fraud, on demand with --fraud (default: all of it):
    rec00421   PLT-006, days 45-59: inflated meter, a second REC for the same days, circular resale
    overcast   PLT-007, days 60-74: overcast days reported as full sun
    meter_gap  PLT-005, days 75-89: meter gaps, and the REC claims ~35% more than was metered
    inflate    PLT-008, days 30-44: mildly inflated meter, small over-claim, quick resales (medium risk)

Always included, independent of --fraud: REC-001 -> REC-002 (report §7's own worked example -
Plant A, Meter M-01, 1 April 12:00-13:00, 72 MWh, certified twice under two REC IDs, so RS-05's
exact-fingerprint match has a natural, precisely-controlled demo case).

Scope note: only these fixed scenarios carry hourly meter_id/interval_start/interval_end
(RS-02/RS-05). The other ~700 meter-days of daily generation across all 8 plants are not
rewritten to hourly resolution here - that's a larger follow-up once the frontend and physics
engine both consume hourly readings throughout, not just for these scripted examples.
"""
import argparse
import csv
import itertools
import json
import math
import random
import urllib.error
import urllib.request
from datetime import date, datetime, time, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = BACKEND_DIR / "data" / "simulated"
DEFAULT_API_URL = "http://localhost:8000/api/v1/ingest"

START = date(2026, 4, 1)
DAYS = 90
WINDOW = 15  # days of generation bundled into one REC

# id, name, owner, latitude, longitude, capacity_kw (all fictional)
PLANTS = [
    ("PLT-001", "Bhuj Solar Park", "Suryodaya Energy", 23.25, 69.67, 5000),
    ("PLT-002", "Jodhpur Sun Farm", "Marwar Renewables", 26.24, 73.02, 3000),
    ("PLT-003", "Anantapur Solar", "Deccan Power Co", 14.68, 77.60, 4000),
    ("PLT-004", "Pavagada Array 7", "Karnataka Green Grid", 14.10, 77.28, 2500),
    ("PLT-005", "Rewa Rooftop Cluster", "Vindhya Solar", 24.53, 81.30, 800),
    ("PLT-006", "Charanka Block B", "Helios Trading Energy", 23.90, 71.20, 2000),
    ("PLT-007", "Bhadla Phase 3", "Thar Photovoltaic", 27.53, 71.91, 6000),
    ("PLT-008", "Kamuthi Solar", "Coromandel Clean Energy", 9.35, 78.37, 3500),
]
TRADERS = [
    "Nimbus Carbon Traders",
    "Greenleaf Offsets",
    "Blue Delta Commodities",
    "Evergreen Corp Sustainability",
    "Kestrel Metals Ltd",
]
# Typical daily irradiation (kWh/m²) across India from April into the monsoon.
MONTHLY_IRRADIATION = {4: 6.5, 5: 6.4, 6: 5.2}

OVERCAST_FAKE_DAYS = {1, 4, 6, 9, 11, 13}  # PLT-007, window 4
METER_GAP_DAYS = {2, 3, 4, 7, 8, 11, 12, 13}  # PLT-005, window 5
CLAIM_FACTOR = {("PLT-005", 5): 1.35, ("PLT-008", 2): 1.10}  # otherwise REC claims 99% of metered

FRAUD_SCENARIOS = ("rec00421", "overcast", "meter_gap", "inflate")


def default_meter_id(plant_id: str) -> str:
    return f"{plant_id}-M1"


def simulate_generation(rng: random.Random, fraud: set[str]) -> tuple[list[dict], dict]:
    rows, metered = [], {}
    for plant_id, *_, capacity in PLANTS:
        for offset in range(DAYS):
            day = START + timedelta(days=offset)
            window, day_in_window = divmod(offset, WINDOW)
            sun = MONTHLY_IRRADIATION[day.month] * rng.uniform(0.88, 1.08)
            if rng.random() < 0.15:
                sun *= rng.uniform(0.3, 0.6)  # cloudy day
            kwh = capacity * sun * rng.uniform(0.74, 0.82)
            recorded_sun = sun

            if "rec00421" in fraud and plant_id == "PLT-006" and window == 3:
                kwh *= rng.uniform(1.45, 1.7)
            if "overcast" in fraud and plant_id == "PLT-007" and window == 4 and day_in_window in OVERCAST_FAKE_DAYS:
                recorded_sun = sun * 0.3  # the sky was overcast, but the meter says full sun
            if "inflate" in fraud and plant_id == "PLT-008" and window == 2:
                kwh *= 1.3
            if "meter_gap" in fraud and plant_id == "PLT-005" and window == 5 and day_in_window in METER_GAP_DAYS:
                continue

            rows.append({
                "plant_id": plant_id,
                "meter_id": default_meter_id(plant_id),
                "day": day.isoformat(),
                "energy_kwh": round(kwh, 1),
                "irradiation_kwh_m2": round(recorded_sun, 3),
            })
            metered[(plant_id, window)] = metered.get((plant_id, window), 0.0) + kwh
    return rows, metered


def _transfer(rec_id, from_party, to_party, when, kind="transfer"):
    return {"rec_id": rec_id, "from_party": from_party, "to_party": to_party, "timestamp": when.isoformat(), "kind": kind}


def _mwh(kwh: float) -> float:
    return math.floor(kwh / 100) / 10  # round down to 0.1 MWh


def _rec(rec_id, plant_id, start, end, energy_mwh, issued_at, holder, *, meter_id="", interval_start="", interval_end="", issuer=""):
    """Every REC row carries the same columns, so csv.DictWriter doesn't choke on the fixed
    hourly examples that set meter_id/interval_start/interval_end and the bulk ones that don't."""
    return {
        "id": rec_id, "plant_id": plant_id, "period_start": start.isoformat(), "period_end": end.isoformat(),
        "energy_mwh": energy_mwh, "issued_at": issued_at.isoformat(), "holder": holder,
        "meter_id": meter_id, "interval_start": interval_start, "interval_end": interval_end, "issuer": issuer,
    }


def simulate_recs(rng: random.Random, metered: dict, fraud: set[str]) -> tuple[list[dict], list[dict]]:
    recs, transfers = [], []
    ids = (f"REC-{n:05d}" for n in itertools.count(400) if n != 421)  # 421 is the planted duplicate

    for window in range(DAYS // WINDOW):
        start = START + timedelta(days=window * WINDOW)
        end = start + timedelta(days=WINDOW - 1)
        for plant_id, _, owner, *_ in PLANTS:
            rec_id = next(ids)
            issued = datetime.combine(end + timedelta(days=3), time(10))
            quick_flips = "inflate" in fraud and (plant_id, window) == ("PLT-008", 2)

            transfers.append(_transfer(rec_id, "Registry", owner, issued, kind="issue"))
            holder, when = owner, issued
            for _ in range(2 if quick_flips else rng.choice([0, 1, 1, 2])):
                buyer = rng.choice([t for t in TRADERS if t != holder])
                when += timedelta(hours=rng.uniform(3, 10)) if quick_flips else timedelta(days=rng.uniform(5, 20))
                transfers.append(_transfer(rec_id, holder, buyer, when))
                holder = buyer

            factor = CLAIM_FACTOR.get((plant_id, window), 0.99) if (
                ("meter_gap" in fraud and (plant_id, window) == ("PLT-005", 5))
                or ("inflate" in fraud and (plant_id, window) == ("PLT-008", 2))
            ) else 0.99
            claimed = metered[(plant_id, window)] * factor
            recs.append(_rec(rec_id, plant_id, start, end, _mwh(claimed), issued, holder))

    if "rec00421" in fraud:
        # PLT-006's inflated window 3, certified a second time and washed through three traders.
        start = START + timedelta(days=3 * WINDOW)
        end = start + timedelta(days=WINDOW - 1)
        issued = datetime.combine(end + timedelta(days=9), time(16, 30))
        owner = "Helios Trading Energy"
        transfers += [
            _transfer("REC-00421", "Registry", owner, issued, kind="issue"),
            _transfer("REC-00421", owner, "Nimbus Carbon Traders", issued + timedelta(hours=2)),
            _transfer("REC-00421", "Nimbus Carbon Traders", "Greenleaf Offsets", issued + timedelta(hours=5)),
            _transfer("REC-00421", "Greenleaf Offsets", owner, issued + timedelta(hours=10)),
        ]
        recs.append(_rec(
            "REC-00421", "PLT-006", start, end, _mwh(metered[("PLT-006", 3)] * 0.97), issued, owner,
            meter_id=default_meter_id("PLT-006"),
        ))

    # Report §7's own worked example (Plant A, Meter M-01, 1 April 12:00-13:00, certified twice)
    # mapped onto PLT-001 (5 MW): quantity scaled down to 3.5 MWh so the pair demonstrates an
    # exact fingerprint match on its own, without also tripping physics's capacity ceiling - the
    # report's literal "72 MWh" was written for a much larger illustrative plant (see §5's
    # separate 100 MW worked example, which REC-00421 stands in for instead).
    meter_id = default_meter_id("PLT-001")
    interval_start = datetime(2026, 4, 1, 12, 0)
    interval_end = datetime(2026, 4, 1, 13, 0)
    issued_1 = datetime(2026, 4, 1, 15, 0)
    issued_2 = datetime(2026, 4, 3, 9, 0)
    transfers += [
        _transfer("REC-001", "Registry", "Buyer X", issued_1, kind="issue"),
        _transfer("REC-002", "Registry", "Buyer Y", issued_2, kind="issue"),
    ]
    recs += [
        _rec(
            "REC-001", "PLT-001", interval_start.date(), interval_end.date(), 3.5, issued_1, "Buyer X",
            meter_id=meter_id, interval_start=interval_start.isoformat(), interval_end=interval_end.isoformat(),
            issuer="Registry",
        ),
        _rec(
            "REC-002", "PLT-001", interval_start.date(), interval_end.date(), 3.5, issued_2, "Buyer Y",
            meter_id=meter_id, interval_start=interval_start.isoformat(), interval_end=interval_end.isoformat(),
            issuer="Registry",
        ),
    ]
    return recs, transfers


def write_csv(name: str, rows: list[dict]) -> None:
    with open(OUT_DIR / name, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def post_ingest(url: str) -> None:
    request = urllib.request.Request(
        url,
        data=json.dumps({"reset": True, "verify": True}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            print("Ingested:", json.load(response))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"{url} returned {exc.code}: {exc.read().decode()}")
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"Could not reach {url} ({exc.reason}). Start the API with `uvicorn app.main:app --reload`, "
            "or rerun with --no-post."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-post", action="store_true", help="don't call the /ingest endpoint")
    parser.add_argument("--api-url", default=DEFAULT_API_URL)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument(
        "--fraud", nargs="*", choices=(*FRAUD_SCENARIOS, "all", "none"), default=["all"],
        help="which planted fraud scenarios to include (default: all). 'none' for a clean baseline.",
    )
    args = parser.parse_args()
    fraud = set(FRAUD_SCENARIOS) if "all" in args.fraud else (set() if "none" in args.fraud else set(args.fraud))

    rng = random.Random(args.seed)
    generation, metered = simulate_generation(rng, fraud)
    recs, transfers = simulate_recs(rng, metered, fraud)
    plants = [
        {
            "id": plant_id,
            "name": name,
            "owner": owner,
            "latitude": lat,
            "longitude": lon,
            "capacity_kw": capacity,
            "technology": "solar",
            "commissioned_on": "2021-01-15",
        }
        for plant_id, name, owner, lat, lon, capacity in PLANTS
    ]
    meters = [{"id": default_meter_id(plant_id), "plant_id": plant_id} for plant_id, *_ in PLANTS]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_csv("plants.csv", plants)
    write_csv("meters.csv", meters)
    write_csv("generation.csv", generation)
    write_csv("recs.csv", recs)
    write_csv("transactions.csv", transfers)
    print(f"Wrote {len(plants)} plants, {len(meters)} meters, {len(generation)} meter-days, {len(recs)} RECs, "
          f"{len(transfers)} transfers to {OUT_DIR} (fraud: {', '.join(sorted(fraud)) or 'none'})")

    from ml.train_anomaly import train  # imported late: needs scikit-learn

    model_path, days = train()
    print(f"Trained anomaly model on {days} meter-days -> {model_path}")

    if not args.no_post:
        post_ingest(args.api_url)


if __name__ == "__main__":
    main()
