"""Train the Isolation Forest used by app/engines/anomaly.py.

Run from backend/:  python -m ml.train_anomaly
"""
import csv
from collections import defaultdict
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.engines.anomaly import build_features

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data" / "simulated"
MODEL_PATH = BACKEND_DIR / "ml" / "artifacts" / "isolation_forest.joblib"

# Roughly the share of meter-days we expect to be suspicious.
CONTAMINATION = 0.05


def train(data_dir: Path = DATA_DIR, model_path: Path = MODEL_PATH) -> tuple[Path, int]:
    with open(data_dir / "plants.csv", newline="", encoding="utf-8") as f:
        capacity = {row["id"]: float(row["capacity_kw"]) for row in csv.DictReader(f)}

    series = defaultdict(list)
    with open(data_dir / "generation.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["irradiation_kwh_m2"]:
                series[row["plant_id"]].append((float(row["energy_kwh"]), float(row["irradiation_kwh_m2"])))

    rows = []
    for plant_id, days in series.items():
        rows += build_features(capacity[plant_id], [kwh for kwh, _ in days], [sun for _, sun in days])

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=42)
    model.fit(np.asarray(rows))
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    return model_path, len(rows)


if __name__ == "__main__":
    path, count = train()
    print(f"Trained on {count} meter-days -> {path}")
