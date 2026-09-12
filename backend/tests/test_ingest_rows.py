import pytest
from pydantic import ValidationError

from app.schemas.ingest_rows import GenerationRow, PlantRow, RecRow, TransactionRow

VALID_PLANT = dict(
    id="PLT-001", name="Bhuj Solar Park", owner="Suryodaya Energy",
    latitude=23.25, longitude=69.67, capacity_kw=5000, technology="solar", commissioned_on=None,
)
VALID_REC = dict(
    id="REC-00421", plant_id="PLT-001", period_start="2026-04-16", period_end="2026-04-30",
    energy_mwh=180.0, issued_at="2026-05-09T16:30:00", holder="Helios Trading Energy",
)


def test_valid_plant_row_parses():
    PlantRow.model_validate(VALID_PLANT)


@pytest.mark.parametrize("field,value", [("latitude", 200), ("longitude", -200), ("capacity_kw", 0)])
def test_plant_row_rejects_out_of_range_values(field, value):
    with pytest.raises(ValidationError):
        PlantRow.model_validate({**VALID_PLANT, field: value})


def test_generation_row_rejects_negative_energy():
    with pytest.raises(ValidationError):
        GenerationRow.model_validate({"plant_id": "PLT-001", "day": "2026-04-01", "energy_kwh": -5, "irradiation_kwh_m2": None})


def test_generation_row_allows_missing_irradiation():
    row = GenerationRow.model_validate({"plant_id": "PLT-001", "day": "2026-04-01", "energy_kwh": 4000, "irradiation_kwh_m2": None})
    assert row.irradiation_kwh_m2 is None


def test_valid_rec_row_parses():
    RecRow.model_validate(VALID_REC)


def test_rec_row_rejects_zero_energy():
    with pytest.raises(ValidationError):
        RecRow.model_validate({**VALID_REC, "energy_mwh": 0})


def test_rec_row_rejects_inverted_period():
    with pytest.raises(ValidationError):
        RecRow.model_validate({**VALID_REC, "period_start": "2026-05-01", "period_end": "2026-04-01"})


def test_rec_row_rejects_blank_holder():
    with pytest.raises(ValidationError):
        RecRow.model_validate({**VALID_REC, "holder": "   "})


def test_transaction_row_rejects_unknown_kind():
    with pytest.raises(ValidationError):
        TransactionRow.model_validate(
            {"rec_id": "REC-00421", "from_party": "Registry", "to_party": "Owner X", "timestamp": "2026-05-09T16:30:00", "kind": "sell"}
        )
