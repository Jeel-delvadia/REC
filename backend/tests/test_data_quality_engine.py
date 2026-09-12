from datetime import date

from app.engines import data_quality as dq


def test_duplicate_ids_detected():
    result = dq.check_duplicate_ids("plants.csv", ["PLT-001", "PLT-002", "PLT-001"])
    assert result["severity"] == "fail"
    assert result["count"] == 1
    assert "PLT-001" in result["message"]


def test_no_duplicates_returns_none():
    assert dq.check_duplicate_ids("plants.csv", ["PLT-001", "PLT-002"]) is None


def test_dangling_reference_detected():
    result = dq.check_dangling_references("generation.csv", "plant_id", ["PLT-001", "PLT-999"], known={"PLT-001"})
    assert result["severity"] == "fail"
    assert result["count"] == 1
    assert "PLT-999" in result["message"]


def test_no_dangling_references_returns_none():
    assert dq.check_dangling_references("generation.csv", "plant_id", ["PLT-001"], known={"PLT-001"}) is None


def test_statistical_outlier_detected_against_plants_own_batch_mean():
    # Five normal readings around 1000 kWh, one wildly out of line - needs the whole group to
    # compute a mean, which is exactly what a per-row Pydantic validator could never do.
    readings = {"PLT-001": [990, 1010, 1000, 995, 1005, 50000]}
    result = dq.check_statistical_outliers(readings)
    assert result is not None
    assert result["severity"] == "warn"
    assert result["count"] == 1


def test_too_few_readings_skips_outlier_check():
    # Only 3 readings - not enough of a baseline to call anything an outlier.
    readings = {"PLT-001": [990, 1010, 50000]}
    assert dq.check_statistical_outliers(readings) is None


def test_completeness_flags_missing_optional_fields():
    result = dq.check_completeness("generation.csv", total_rows=10, missing_counts={"irradiation_kwh_m2": 4})
    assert result is not None
    assert "6/10 populated" in result["message"]
    assert result["count"] == 4


def test_full_completeness_returns_none():
    assert dq.check_completeness("generation.csv", total_rows=10, missing_counts={"irradiation_kwh_m2": 0}) is None


def test_freshness_flags_stale_data():
    result = dq.check_freshness(date(2026, 1, 1), today=date(2026, 6, 1))
    assert result is not None
    assert result["severity"] == "warn"


def test_freshness_ok_within_window():
    assert dq.check_freshness(date(2026, 6, 1), today=date(2026, 6, 10)) is None


def test_run_scores_100_when_nothing_found():
    report = dq.run([None, None, None])
    assert report == {"score": 100, "issues": []}


def test_run_deducts_penalty_per_severity():
    issues = [
        {"rule": "x", "file": "a", "severity": "fail", "message": "m", "count": 1},
        {"rule": "y", "file": "a", "severity": "warn", "message": "m", "count": 1},
        None,
    ]
    report = dq.run(issues)
    assert report["score"] == 100 - 20 - 8
    assert len(report["issues"]) == 2


def test_score_never_goes_negative():
    issues = [{"rule": "x", "file": "a", "severity": "fail", "message": "m", "count": 1}] * 10
    assert dq.score(issues) == 0
