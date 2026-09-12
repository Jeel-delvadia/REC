"""Loads plant, meter, REC and transfer CSVs (data/simulated/) into the database.

Every row is validated (RS-10) before it's turned into an ORM object. A bad row is skipped
and reported, not fatal - one malformed line in generation.csv shouldn't sink the whole batch.
"""
import csv
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert, AuditAction, Generation, LedgerEntry, Plant, Rec, Transaction, VerificationResult
from app.schemas.ingest_rows import GenerationRow, PlantRow, RecRow, TransactionRow
from app.services import NotFoundError, audit_service, verification_service

FILES = ("plants.csv", "generation.csv", "recs.csv", "transactions.csv")
# Children before parents, so foreign keys never block the wipe.
RESET_ORDER = (Alert, AuditAction, VerificationResult, Transaction, LedgerEntry, Rec, Generation, Plant)


def _read(directory: Path, name: str) -> list[dict]:
    with open(directory / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _validate_rows(file_name: str, raw_rows: list[dict], row_model: type, errors: list[str]) -> list:
    """Parse each row with its Pydantic model; keep the valid ones, record the rest."""
    valid = []
    for i, raw in enumerate(raw_rows, start=2):  # row 1 is the header
        # Pydantic treats "" as a value, not "missing" - CSV leaves optional fields empty.
        cleaned = {k: (v if v != "" else None) for k, v in raw.items()}
        try:
            valid.append(row_model.model_validate(cleaned))
        except ValidationError as exc:
            errors.append(f"{file_name}:{i}: {exc.errors()[0]['msg']}")
    return valid


def load_csv_data(db: Session, *, reset: bool = True, verify: bool = True, directory: Path | None = None) -> dict:
    directory = Path(directory or settings.DATA_DIR)
    missing = [name for name in FILES if not (directory / name).exists()]
    if missing:
        raise NotFoundError(
            f"Missing {', '.join(missing)} in {directory}. Generate them with: python -m scripts.seed_data --no-post"
        )

    if reset:
        for model in RESET_ORDER:
            db.execute(delete(model))

    errors: list[str] = []
    plant_rows = _validate_rows("plants.csv", _read(directory, "plants.csv"), PlantRow, errors)
    generation_rows = _validate_rows("generation.csv", _read(directory, "generation.csv"), GenerationRow, errors)
    rec_rows = _validate_rows("recs.csv", _read(directory, "recs.csv"), RecRow, errors)
    transaction_rows = _validate_rows("transactions.csv", _read(directory, "transactions.csv"), TransactionRow, errors)

    # Referential checks against the batch being loaded - a row can be well-formed on its own
    # and still point at a plant or REC that doesn't exist anywhere in this ingest.
    known_plants = {row.id for row in plant_rows}
    known_recs = {row.id for row in rec_rows}
    generation_rows = _drop_unknown_refs("generation.csv", generation_rows, "plant_id", known_plants, errors)
    rec_rows = _drop_unknown_refs("recs.csv", rec_rows, "plant_id", known_plants, errors)
    transaction_rows = _drop_unknown_refs("transactions.csv", transaction_rows, "rec_id", known_recs, errors)

    plants = [
        Plant(
            id=row.id, name=row.name, owner=row.owner, latitude=row.latitude, longitude=row.longitude,
            capacity_kw=row.capacity_kw, technology=row.technology, commissioned_on=row.commissioned_on,
        )
        for row in plant_rows
    ]
    generation = [
        Generation(plant_id=row.plant_id, day=row.day, energy_kwh=row.energy_kwh, irradiation_kwh_m2=row.irradiation_kwh_m2)
        for row in generation_rows
    ]
    recs = [
        Rec(
            id=row.id, plant_id=row.plant_id, period_start=row.period_start, period_end=row.period_end,
            energy_mwh=row.energy_mwh, issued_at=row.issued_at, holder=row.holder,
        )
        for row in rec_rows
    ]
    transactions = [
        Transaction(rec_id=row.rec_id, from_party=row.from_party, to_party=row.to_party, timestamp=row.timestamp, kind=row.kind)
        for row in transaction_rows
    ]
    db.add_all(plants + generation + recs + transactions)
    db.flush()

    # Record issuance and every transfer on the ledger, oldest first.
    recs_by_id = {rec.id: rec for rec in recs}
    events = []
    for t in transactions:
        if t.kind == "issue":
            rec = recs_by_id[t.rec_id]
            payload = {
                "plant_id": rec.plant_id,
                "energy_mwh": rec.energy_mwh,
                "period": f"{rec.period_start}/{rec.period_end}",
                "holder": t.to_party,
                "at": t.timestamp.isoformat(),
            }
            events.append((t.timestamp, "ISSUED", t.rec_id, payload))
        else:
            payload = {"from": t.from_party, "to": t.to_party, "at": t.timestamp.isoformat()}
            events.append((t.timestamp, "TRANSFERRED", t.rec_id, payload))
    for _, event_type, rec_id, payload in sorted(events, key=lambda e: e[0]):
        audit_service.append_ledger(db, event_type, rec_id, payload)
    db.commit()

    verified = 0
    if verify:
        # Rule-based explanations here; an auditor's "Run verification" click gets the LLM one.
        for rec in recs:
            verification_service.verify_rec(db, rec.id, use_llm=False)
            verified += 1

    return {
        "plants": len(plants),
        "generation": len(generation),
        "recs": len(recs),
        "transactions": len(transactions),
        "verified": verified,
        "errors": errors,
    }


def _drop_unknown_refs(file_name: str, rows: list, field: str, known: set[str], errors: list[str]) -> list:
    kept = []
    for row in rows:
        value = getattr(row, field)
        if value in known:
            kept.append(row)
        else:
            errors.append(f"{file_name}: {field} '{value}' not found in this batch - row skipped")
    return kept
