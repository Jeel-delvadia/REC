"""Train the Isolation Forest used by app/engines/anomaly.py, on report §6's six per-REC
features - computed here straight from the CSVs (no DB), the same way
verification_service._anomaly_features computes them from the database at request time.

Run from backend/:  python -m ml.train_anomaly
"""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.engines import anomaly, duplicate, physics

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data" / "simulated"
MODEL_PATH = BACKEND_DIR / "ml" / "artifacts" / "isolation_forest.joblib"

# Roughly the share of RECs we expect to be suspicious in the training set.
CONTAMINATION = 0.05
ISSUANCE_FREQUENCY_WINDOW_DAYS = 45


def _load(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    plants = pd.read_csv(data_dir / "plants.csv", parse_dates=["commissioned_on"])
    generation = pd.read_csv(data_dir / "generation.csv", parse_dates=["day"])
    recs = pd.read_csv(data_dir / "recs.csv", parse_dates=["period_start", "period_end", "issued_at"])
    return plants, generation, recs


def build_feature_frame(plants: pd.DataFrame, generation: pd.DataFrame, recs: pd.DataFrame) -> pd.DataFrame:
    capacity_by_plant = plants.set_index("id")["capacity_kw"]
    generation = generation.assign(month=generation["day"].dt.month)
    monthly_avg = generation.groupby(["plant_id", "month"])["energy_kwh"].mean()
    window = pd.Timedelta(days=ISSUANCE_FREQUENCY_WINDOW_DAYS)

    rows = []
    for rec in recs.itertuples():
        plant_gen = generation[generation["plant_id"] == rec.plant_id]
        in_period = plant_gen[(plant_gen["day"] >= rec.period_start) & (plant_gen["day"] <= rec.period_end)]

        capacity_kw = capacity_by_plant.get(rec.plant_id, 0.0)
        period_days = (rec.period_end - rec.period_start).days + 1
        claimed_kwh = rec.energy_mwh * 1000

        metered_kwh = in_period["energy_kwh"].sum()
        expected_kwh = sum(
            physics.expected_daily_kwh(capacity_kw, sun)
            for sun in in_period["irradiation_kwh_m2"].dropna()
        )

        this_avg = in_period["energy_kwh"].mean() if len(in_period) else claimed_kwh / period_days
        plant_month_avg = monthly_avg.get((rec.plant_id, rec.period_start.month), 0.0)
        seasonal_deviation = abs(this_avg - plant_month_avg) / plant_month_avg if plant_month_avg else 0.0

        siblings = recs[
            (recs["plant_id"] == rec.plant_id) & (recs["id"] != rec.id)
            & (recs["issued_at"].between(rec.issued_at - window, rec.issued_at + window))
        ]
        issuance_delay_days = max(0, (rec.issued_at.date() - rec.period_end.date()).days)

        rows.append([
            duplicate.ratio(claimed_kwh, expected_kwh),
            duplicate.ratio(claimed_kwh, metered_kwh),
            claimed_kwh / (capacity_kw * period_days * 24) if capacity_kw else 0.0,
            seasonal_deviation,
            len(siblings),
            issuance_delay_days,
        ])
    return pd.DataFrame(rows, columns=list(anomaly.FEATURES))


def train(data_dir: Path = DATA_DIR, model_path: Path = MODEL_PATH) -> tuple[Path, int]:
    plants, generation, recs = _load(data_dir)
    features = build_feature_frame(plants, generation, recs)

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=42)
    model.fit(features.to_numpy())
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    return model_path, len(features)


if __name__ == "__main__":
    path, count = train()
    print(f"Trained on {count} RECs -> {path}")
