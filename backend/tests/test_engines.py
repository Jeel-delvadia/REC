from datetime import date, datetime, timedelta

from app.engines import duplicate, graph, ledger, physics


def test_expected_generation_uses_peak_sun_hours():
    # 1 MW plant, 5 kWh/m² of sunlight, 80% performance ratio -> 4 MWh
    assert physics.expected_daily_kwh(1000, 5.0, 0.8) == 4000


def test_physics_compares_meter_with_sunlight():
    result = physics.assess(1000, metered_kwh=[6000, 6000], irradiation=[5.0, 5.0], performance_ratio=0.8)
    assert result["expected_kwh"] == 8000
    assert result["ratio"] == 1.5
    assert result["days_over_capacity"] == 0


def test_physics_flags_days_above_plant_maximum():
    result = physics.assess(1000, metered_kwh=[9000], irradiation=[7.0], performance_ratio=0.8)
    assert result["days_over_capacity"] == 1


def test_default_performance_ratio_is_derived_from_pvlib_pvwatts_defaults():
    # Not hand-picked: (1 - pvwatts_losses()/100) * inverter.pvwatts's default eta_inv_nom.
    assert 0.75 < physics.DEFAULT_PERFORMANCE_RATIO < 0.90


def test_assess_claim_matches_the_report_worked_example_shape():
    # Report §5: 100 MW plant, 1h interval, 180 MWh claimed, ~74 MWh physics estimate.
    result = physics.assess_claim(
        capacity_kw=100_000, claimed_kwh=180_000, interval_hours=1,
        irradiation_kwh_m2=0.9, performance_ratio=0.8248,
    )
    assert result["ceiling_kwh"] == 100_000
    assert result["exceeds_ceiling"] is True
    assert 70_000 < result["expected_kwh"] < 78_000


def test_overlapping_recs_count_towards_total_claim():
    result = duplicate.double_counting(
        claimed_kwh=10_000,
        metered_kwh=10_000,
        period=(date(2026, 5, 1), date(2026, 5, 15)),
        other_claims=[{"rec_id": "REC-2", "start": date(2026, 5, 1), "end": date(2026, 5, 15), "energy_kwh": 10_000}],
    )
    assert result["overlapping_recs"] == [{"rec_id": "REC-2", "overlap_days": 15}]
    assert result["total_claim_ratio"] == 2.0


def test_partial_overlap_is_prorated():
    result = duplicate.double_counting(
        claimed_kwh=0,
        metered_kwh=10_000,
        period=(date(2026, 5, 1), date(2026, 5, 10)),
        other_claims=[{"rec_id": "REC-2", "start": date(2026, 5, 6), "end": date(2026, 5, 15), "energy_kwh": 10_000}],
    )
    assert result["total_claimed_kwh"] == 5_000


def test_claim_without_meter_data_is_not_a_zero_ratio():
    assert duplicate.claim_vs_meter(5_000, 0, 0, 15)["claim_ratio"] == duplicate.NO_BASELINE


def test_fingerprint_is_deterministic():
    args = ("PLT-001", "PLT-001-M1", date(2026, 4, 1), date(2026, 4, 1), 72.0)
    assert duplicate.fingerprint(*args) == duplicate.fingerprint(*args)


def test_fingerprint_changes_with_any_input():
    base = duplicate.fingerprint("PLT-001", "PLT-001-M1", date(2026, 4, 1), date(2026, 4, 1), 72.0)
    assert duplicate.fingerprint("PLT-002", "PLT-001-M1", date(2026, 4, 1), date(2026, 4, 1), 72.0) != base
    assert duplicate.fingerprint("PLT-001", "PLT-001-M1", date(2026, 4, 1), date(2026, 4, 1), 72.1) != base


def test_fingerprint_accepts_date_or_datetime():
    # Report §7 example: Plant A, Meter M-01, 1 April 12:00-13:00, 72 MWh.
    fp = duplicate.fingerprint(
        "PLT-A", "M-01", datetime(2026, 4, 1, 12, 0), datetime(2026, 4, 1, 13, 0), 72.0
    )
    assert isinstance(fp, str) and len(fp) == 64


def test_double_counting_reports_a_fingerprint_match_separately_from_overlap():
    result = duplicate.double_counting(
        claimed_kwh=72_000, metered_kwh=72_000,
        period=(date(2026, 4, 1), date(2026, 4, 1)), other_claims=[],
        fingerprint_matches=["REC-001"],
    )
    assert result["fingerprint_matches"] == ["REC-001"]


def _chain(payloads):
    entries, prev = [], ledger.GENESIS_HASH
    for i, payload in enumerate(payloads, start=1):
        at = f"2026-05-0{i}T00:00:00"
        digest = ledger.compute_hash(prev, "event", "REC-1", payload, at)
        entries.append({
            "id": i, "event_type": "event", "rec_id": "REC-1", "payload": payload,
            "created_at": at, "prev_hash": prev, "hash": digest,
        })
        prev = digest
    return entries


def test_untouched_ledger_verifies():
    result = ledger.verify_chain(_chain([{"a": 1}, {"b": 2}, {"c": 3}]))
    assert result["valid"] and result["entries_checked"] == 3


def test_edited_ledger_entry_is_detected():
    entries = _chain([{"a": 1}, {"b": 2}, {"c": 3}])
    entries[1]["payload"] = {"b": 999}
    result = ledger.verify_chain(entries)
    assert not result["valid"]
    assert result["broken_at"] == 2


def test_deleted_ledger_entry_is_detected():
    entries = _chain([{"a": 1}, {"b": 2}, {"c": 3}])
    del entries[1]
    assert ledger.verify_chain(entries)["broken_at"] == 3


def test_rec_integrity_passes_when_row_matches_its_history():
    entries = [
        {"event_type": "ISSUED", "payload": {"energy_mwh": 180.0, "holder": "Owner X"}},
        {"event_type": "TRANSFERRED", "payload": {"from": "Owner X", "to": "Owner Y"}},
    ]
    result = ledger.check_rec_integrity({"energy_mwh": 180.0, "holder": "Owner Y"}, entries)
    assert result["consistent"]


def test_rec_integrity_catches_a_row_edited_outside_the_ledger():
    # RS-07 / report §15 step 5: someone edits energy_mwh directly in the database.
    entries = [{"event_type": "ISSUED", "payload": {"energy_mwh": 72.0, "holder": "Owner X"}}]
    result = ledger.check_rec_integrity({"energy_mwh": 180.0, "holder": "Owner X"}, entries)
    assert not result["consistent"]
    assert "72.0" in result["reason"] and "180.0" in result["reason"]


def test_rec_integrity_catches_a_holder_changed_outside_the_ledger():
    entries = [
        {"event_type": "ISSUED", "payload": {"energy_mwh": 72.0, "holder": "Owner X"}},
        {"event_type": "TRANSFERRED", "payload": {"from": "Owner X", "to": "Owner Y"}},
    ]
    result = ledger.check_rec_integrity({"energy_mwh": 72.0, "holder": "Someone Else"}, entries)
    assert not result["consistent"]
    assert "Owner Y" in result["reason"]


def test_rec_integrity_with_no_issued_entry_is_not_a_finding():
    assert ledger.check_rec_integrity({"energy_mwh": 1.0, "holder": "X"}, [])["consistent"]


def test_circular_resale_is_detected():
    t0 = datetime(2026, 5, 1, 9)
    result = graph.analyse_chain([
        {"from_party": "Registry", "to_party": "A", "timestamp": t0, "kind": "issue"},
        {"from_party": "A", "to_party": "B", "timestamp": t0 + timedelta(hours=2), "kind": "transfer"},
        {"from_party": "B", "to_party": "C", "timestamp": t0 + timedelta(hours=4), "kind": "transfer"},
        {"from_party": "C", "to_party": "A", "timestamp": t0 + timedelta(hours=6), "kind": "transfer"},
    ])
    assert result["cycle"]
    assert result["cycle_parties"] == ["A", "B", "C"]
    assert result["rapid_resales"] == 3
    assert result["transfers"] == 3


def test_ordinary_resale_is_clean():
    t0 = datetime(2026, 5, 1, 9)
    result = graph.analyse_chain([
        {"from_party": "Registry", "to_party": "A", "timestamp": t0, "kind": "issue"},
        {"from_party": "A", "to_party": "B", "timestamp": t0 + timedelta(days=10), "kind": "transfer"},
    ])
    assert not result["cycle"] and result["rapid_resales"] == 0
