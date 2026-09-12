"""SHA-256 hash chain: each entry's hash covers its content and the previous entry's hash,
so editing or deleting any past entry breaks every hash after it.

Pure functions. No database, no HTTP.
"""
import hashlib
import json
from collections.abc import Iterable

GENESIS_HASH = "0" * 64


def compute_hash(prev_hash: str, event_type: str, rec_id: str | None, payload: dict, created_at: str) -> str:
    body = json.dumps(
        {"prev": prev_hash, "type": event_type, "rec": rec_id, "payload": payload, "at": created_at},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(body.encode()).hexdigest()


def check_rec_integrity(rec_snapshot: dict, rec_entries: list[dict]) -> dict:
    """Does a REC's current row match what its own ledger entries recorded?

    `rec_snapshot`: {"energy_mwh", "holder"} read from the database right now.
    `rec_entries`: this REC's ledger entries, in chain order, each with "event_type" and "payload".
    Catches exactly the report's demo scenario (Sec15 step 5): editing a REC's quantity or
    holder directly in the database, bypassing the ledger, leaves the ledger's own hash chain
    internally consistent but out of step with the row it describes.
    """
    issued = next((e for e in rec_entries if e["event_type"] == "ISSUED"), None)
    if issued is None:
        # Nothing to compare against (older data, or the ledger predates this check) - not a finding.
        return {"consistent": True, "reason": None, "expected_energy_mwh": None, "expected_holder": None}

    expected_energy = issued["payload"].get("energy_mwh")
    transfers = [e for e in rec_entries if e["event_type"] == "TRANSFERRED"]
    expected_holder = transfers[-1]["payload"]["to"] if transfers else issued["payload"].get("holder")

    energy_ok = expected_energy is None or abs(rec_snapshot["energy_mwh"] - expected_energy) < 1e-6
    holder_ok = expected_holder is None or rec_snapshot["holder"] == expected_holder
    if energy_ok and holder_ok:
        return {"consistent": True, "reason": None, "expected_energy_mwh": expected_energy, "expected_holder": expected_holder}

    problems = []
    if not energy_ok:
        problems.append(f"row shows {rec_snapshot['energy_mwh']} MWh but the ledger's ISSUED entry recorded {expected_energy} MWh")
    if not holder_ok:
        problems.append(f"row shows holder '{rec_snapshot['holder']}' but the ledger's last transfer recorded '{expected_holder}'")
    return {
        "consistent": False,
        "reason": "; ".join(problems),
        "expected_energy_mwh": expected_energy,
        "expected_holder": expected_holder,
    }


def verify_chain(entries: Iterable[dict]) -> dict:
    """`entries` in chain order, each {"id", "event_type", "rec_id", "payload", "created_at", "prev_hash", "hash"}."""
    prev, checked = GENESIS_HASH, 0
    for entry in entries:
        checked += 1
        expected = compute_hash(prev, entry["event_type"], entry["rec_id"], entry["payload"], entry["created_at"])
        if entry["prev_hash"] != prev or entry["hash"] != expected:
            return {"valid": False, "entries_checked": checked, "broken_at": entry["id"], "head_hash": prev}
        prev = entry["hash"]
    return {"valid": True, "entries_checked": checked, "broken_at": None, "head_hash": prev if checked else None}
