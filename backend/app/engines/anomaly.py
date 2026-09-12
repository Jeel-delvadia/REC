"""REC-level anomaly detection with an Isolation Forest, trained on the report's six §6
features (see ml/train_anomaly.py): claim-to-expected ratio, claim-to-meter ratio, capacity
utilisation, deviation from the plant's own seasonal profile, issuance frequency for the
plant, and the delay between the generation interval and issuance.

No database, no HTTP - the model and every feature value are passed in.
"""
from pathlib import Path

import joblib
import numpy as np

FEATURES = (
    "claim_to_expected_ratio",
    "claim_to_meter_ratio",
    "capacity_utilisation",
    "seasonal_deviation",
    "issuance_frequency",
    "issuance_delay_days",
)

# decision_function centres on 0 (positive = normal, negative = outlier). Linearly maps
# [-_SCORE_SPAN, +_SCORE_SPAN] to [1, 0] (higher = more anomalous), clipped beyond that -
# not a calibrated probability, just a readable 0-1 scale for risk_service to ramp against.
_SCORE_SPAN = 0.35


def build_features(
    claim_to_expected_ratio: float,
    claim_to_meter_ratio: float,
    capacity_utilisation: float,
    seasonal_deviation: float,
    issuance_frequency: int,
    issuance_delay_days: int,
) -> list[float]:
    """One row, in FEATURES order."""
    return [
        claim_to_expected_ratio, claim_to_meter_ratio, capacity_utilisation,
        seasonal_deviation, issuance_frequency, issuance_delay_days,
    ]


def load_model(path: Path):
    return joblib.load(path) if Path(path).exists() else None


def assess(model, features: list[float]) -> dict:
    if model is None:
        return {"available": False, "is_anomalous": False, "anomaly_score": 0.0}
    row = np.asarray([features])
    is_anomalous = bool(model.predict(row)[0] == -1)
    raw = float(model.decision_function(row)[0])
    anomaly_score = max(0.0, min(1.0, 0.5 - raw / (2 * _SCORE_SPAN)))
    return {"available": True, "is_anomalous": is_anomalous, "anomaly_score": round(anomaly_score, 3)}
