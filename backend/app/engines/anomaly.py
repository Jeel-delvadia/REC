"""Meter anomaly detection with an Isolation Forest trained on daily readings (see ml/train_anomaly.py).

No database, no HTTP. The model is loaded from a file and passed in.
"""
from pathlib import Path

import joblib
import numpy as np

FEATURES = ("capacity_factor", "performance_ratio")


def build_features(capacity_kw: float, daily_kwh: list[float], irradiation: list[float]) -> list[list[float]]:
    """One row per day: how hard the plant ran, and how much energy it got per unit of sunlight."""
    rows = []
    for kwh, sun in zip(daily_kwh, irradiation):
        capacity_factor = kwh / (capacity_kw * 24) if capacity_kw else 0.0
        performance_ratio = kwh / (capacity_kw * sun) if capacity_kw and sun > 0 else 0.0
        rows.append([capacity_factor, performance_ratio])
    return rows


def load_model(path: Path):
    return joblib.load(path) if Path(path).exists() else None


def assess(model, features: list[list[float]]) -> dict:
    if model is None or not features:
        return {"available": model is not None, "days": len(features), "anomalous_days": 0, "fraction": 0.0}
    labels = model.predict(np.asarray(features))  # -1 marks an outlier
    anomalous = int((labels == -1).sum())
    return {
        "available": True,
        "days": len(features),
        "anomalous_days": anomalous,
        "fraction": round(anomalous / len(features), 3),
    }
