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
