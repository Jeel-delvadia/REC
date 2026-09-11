"""Loads plant, meter, REC and transfer CSVs (data/simulated/) into the database."""
import csv
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert, AuditAction, Generation, LedgerEntry, Plant, Rec, Transaction, VerificationResult
from app.services import NotFoundError, audit_service, verification_service

FILES = ("plants.csv", "generation.csv", "recs.csv", "transactions.csv")
# Children before parents, so foreign keys never block the wipe.
RESET_ORDER = (Alert, AuditAction, VerificationResult, Transaction, LedgerEntry, Rec, Generation, Plant)


def _read(directory: Path, name: str) -> list[dict]:
    with open(directory / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _optional_float(value: str) -> float | None:
    return float(value) if value else None


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

    plants = [
        Plant(
            id=row["id"],
            name=row["name"],
            owner=row["owner"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            capacity_kw=float(row["capacity_kw"]),
            technology=row["technology"],
            commissioned_on=date.fromisoformat(row["commissioned_on"]) if row["commissioned_on"] else None,
        )
        for row in _read(directory, "plants.csv")
    ]
    generation = [
        Generation(
            plant_id=row["plant_id"],
            day=date.fromisoformat(row["day"]),
            energy_kwh=float(row["energy_kwh"]),
            irradiation_kwh_m2=_optional_float(row["irradiation_kwh_m2"]),
        )
        for row in _read(directory, "generation.csv")
    ]
    recs = [
        Rec(
            id=row["id"],
            plant_id=row["plant_id"],
            period_start=date.fromisoformat(row["period_start"]),
            period_end=date.fromisoformat(row["period_end"]),
            energy_mwh=float(row["energy_mwh"]),
            issued_at=datetime.fromisoformat(row["issued_at"]),
            holder=row["holder"],
        )
        for row in _read(directory, "recs.csv")
    ]
    transactions = [
        Transaction(
            rec_id=row["rec_id"],
            from_party=row["from_party"],
            to_party=row["to_party"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            kind=row["kind"],
        )
        for row in _read(directory, "transactions.csv")
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
            events.append((t.timestamp, "issued", t.rec_id, payload))
        else:
            payload = {"from": t.from_party, "to": t.to_party, "at": t.timestamp.isoformat()}
            events.append((t.timestamp, "transferred", t.rec_id, payload))
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
    }
