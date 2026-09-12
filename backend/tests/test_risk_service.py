from app.services import risk_service

CLEAN = {"physics": 0.0, "meter_match": 0.0, "duplicate": 0.0, "anomaly": 0.0, "provenance": 0.0}


def test_band_thresholds():
    scores = (0, 30, 31, 60, 61, 80, 81, 100)
    assert [risk_service.band_for(s) for s in scores] == [
        "genuine", "genuine", "suspicious", "suspicious", "high_risk", "high_risk", "likely_fraud", "likely_fraud",
    ]


def test_clean_rec_scores_zero():
    assert risk_service.score(CLEAN) == 0


def test_report_worked_example_rec_00421():
    # Report §6: 0.30*100 + 0.25*100 + 0.25*100 + 0.15*73 + 0.05*0 = 90.95 -> 91, likely_fraud.
    risks = {"physics": 1.0, "meter_match": 1.0, "duplicate": 1.0, "anomaly": 0.73, "provenance": 0.0}
    score = risk_service.score(risks)
    assert score == 91
    assert risk_service.band_for(score) == "likely_fraud"


def test_a_single_failed_check_alone_does_not_reach_likely_fraud():
    # Report §6 has no minimum-score floor: one failed check at weight 25 caps out at 25.
    score = risk_service.score({**CLEAN, "meter_match": 1.0})
    assert score == 25
    assert risk_service.band_for(score) == "genuine"


def test_physics_risk_ramps_with_ratio():
    base = {"days": 15, "days_over_capacity": 0}
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.0}})["physics"] == 0.0
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.25}})["physics"] == 0.5
    assert risk_service.check_risks({"physics": {**base, "ratio": 1.5}})["physics"] == 1.0


def test_missing_data_is_not_treated_as_clean():
    risk = risk_service.check_risks({"physics": {"days": 0, "days_over_capacity": 0, "ratio": 0.0}})["physics"]
    assert risk_service.status_for(risk) != "pass"


def test_check_status_thresholds_match_report():
    # Report §6: below 40 pass, 40-79 warn, 80 and above fail (sub-score = risk * 100).
    assert risk_service.status_for(0.39) == "pass"
    assert risk_service.status_for(0.40) == "warn"
    assert risk_service.status_for(0.79) == "warn"
    assert risk_service.status_for(0.80) == "fail"


def test_reason_codes():
    assert risk_service.check_reason("physics", {"days": 0}) == "PHYSICS_NO_DATA"
    assert risk_service.check_reason("physics", {"days": 10, "days_over_capacity": 1, "ratio": 1.0}) == (
        "PHYSICS_EXCEEDS_CAPACITY"
    )
    assert risk_service.check_reason(
        "duplicate", {"overlapping_recs": [{"rec_id": "REC-2", "overlap_days": 5}]}
    ) == "DUPLICATE_OVERLAPPING_CLAIM"
    assert risk_service.check_reason("provenance", {"cycle": True, "rapid_resales": 0}) == (
        "PROVENANCE_CIRCULAR_TRANSFER"
    )
