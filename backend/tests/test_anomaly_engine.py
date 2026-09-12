import random

from sklearn.ensemble import IsolationForest

from app.engines import anomaly


def _toy_model():
    """A tiny model trained on a tight cluster of normal rows, fast enough for a unit test."""
    rng = random.Random(0)
    normal = [
        [1.0 + rng.uniform(-0.05, 0.05), 1.0 + rng.uniform(-0.05, 0.05), 0.3 + rng.uniform(-0.02, 0.02),
         0.05 + rng.uniform(-0.02, 0.02), 2 + rng.randint(-1, 1), 3 + rng.randint(-1, 1)]
        for _ in range(60)
    ]
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=0)
    model.fit(normal)
    return model


def test_build_features_orders_correctly():
    row = anomaly.build_features(1.1, 1.0, 0.3, 0.05, 2, 3)
    assert row == [1.1, 1.0, 0.3, 0.05, 2, 3]


def test_assess_with_no_model_reports_unavailable():
    result = anomaly.assess(None, [1.0] * 6)
    assert result == {"available": False, "is_anomalous": False, "anomaly_score": 0.0}


def test_assess_flags_a_row_far_from_training_data():
    model = _toy_model()
    normal = anomaly.assess(model, anomaly.build_features(1.0, 1.0, 0.3, 0.05, 2, 3))
    outlier = anomaly.assess(model, anomaly.build_features(9.0, 9.0, 0.99, 3.0, 40, 200))
    assert normal["available"] and outlier["available"]
    assert outlier["anomaly_score"] > normal["anomaly_score"]
    assert outlier["is_anomalous"]
    assert not normal["is_anomalous"]
