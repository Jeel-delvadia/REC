from app.services import risk_service

CLEAN = {"physics": 0.0, "meter_match": 0.0, "duplicate": 0.0, "anomaly": 0.0, "provenance": 0.0}


def test_band_thresholds():
    scores = (0, 39, 40, 59, 60, 64, 79, 80, 100)
    assert [risk_service.band_for(s) for s in scores] == [
        "low", "low", "medium", "medium", "high", "high", "high", "critical", "critical",
    ]


def test_clean_rec_scores_zero():
    assert risk_service.score(CLEAN) == 0


def test_one_hard_failure_is_enough_for_high_risk():
    score = risk_service.score({**CLEAN, "meter_match": 1.0})
    assert risk_service.band_for(score) == "high"


def test_soft_checks_alone_cannot_trigger_the_floor():
    score = risk_service.score({**CLEAN, "anomaly": 1.0, "provenance": 1.0})
    assert score == 20


def test_physics_risk_ramps_with_ratio():
    base = {"days": 15, "days_over_capacity": 0}
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.0}})["physics"] == 0.0
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.25}})["physics"] == 0.5
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.5}})["physics"] == 1.0


def test_missing_data_is_not_treated_as_clean():
    risk = risk_service.check_risks({"physics": {"days": 0, "days_over_capacity": 0, "ratio": 0.0}})["physics"]
    assert risk_service.status_for(risk) != "pass"
