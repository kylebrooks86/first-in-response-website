"""Offline QA-only plan for retiring one legacy availability JSON array.

No network, Cloudflare, D1 connection, backups, SQL execution or provider write.
Caller must independently verify current QA Worker/D1 identity and backups,
receive separate approval for hosted cleanup, then run an authorized guarded
execution. Do NOT use this plan to update LIVE or any staging/production DB.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Optional

QA_NAME = "fire-fullapp-qa-db-20261016"
QA_UUID = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
PREFERENCES_KEY = "fire:business-preferences:v1"
MAX_PREF_BYTES = 150_000

# Exact target key and full original JSON body both guard one row. There is
# intentionally NO unguarded UPDATE, DELETE, DROP or migration in this module.
GUARDED_UPDATE = (
    "UPDATE message_templates SET body=?,updated_at=? "
    "WHERE key=? AND body=?"
)


@dataclass(frozen=True)
class CleanupPlan:
    qa_name: str
    qa_uuid: str
    key: str
    old_body_sha256: str
    removed_block_count: int
    repeat_interval_count: int
    sql: Optional[str] = None
    parameters: tuple[str, ...] = ()

    @property
    def needs_cleanup(self) -> bool:
        return self.sql is not None


def prepare_qa_cleanup(
    *, qa_name: str, qa_uuid: str, old_body: Optional[str],
    new_timestamp: str
) -> CleanupPlan:
    """Create a never-executed, compare-and-swap SQL plan for exactly one QA row.

    Original JSON is an opaque compare-and-swap parameter, not echoed in the
    summary. A failed/mismatched write receipt must STOP, not be retried blindly.
    """
    if qa_name != QA_NAME or qa_uuid != QA_UUID:
        raise ValueError("QA_ONLY_IDENTITY_MISMATCH")
    if not isinstance(new_timestamp, str) or not new_timestamp.endswith("Z") or len(new_timestamp) != 24:
        raise ValueError("TIMESTAMP_UNVERIFIED")
    if old_body is None:
        return CleanupPlan(qa_name, qa_uuid, PREFERENCES_KEY, "", 0, 0)
    if not isinstance(old_body, str) or len(old_body.encode("utf-8")) > MAX_PREF_BYTES:
        raise ValueError("PREFERENCES_SIZE_OR_TYPE_INVALID")
    try:
        prefs = json.loads(old_body)
    except (ValueError, TypeError) as exc:
        raise ValueError("PREFERENCES_INVALID_JSON") from exc
    if not isinstance(prefs, dict) or set(prefs) != {"revision", "blocks", "repeatMonths"}:
        raise ValueError("PREFERENCES_SHAPE_UNVERIFIED")
    blocks, repeat = prefs["blocks"], prefs["repeatMonths"]
    if not isinstance(blocks, list) or not isinstance(repeat, dict):
        raise ValueError("PREFERENCES_PARTS_INVALID")
    if len(blocks) > 500 or len(repeat) > 558:
        raise ValueError("PREFERENCES_LIMITS_UNVERIFIED")
    if prefs["revision"] is not None and not isinstance(prefs["revision"], str):
        raise ValueError("REVISION_UNVERIFIED")
    if any(not isinstance(k, str) or not isinstance(v, int) or isinstance(v, bool) or v < 0 or v > 120 for k, v in repeat.items()):
        raise ValueError("REPEAT_INTERVALS_UNVERIFIED")
    hash_before = hashlib.sha256(old_body.encode("utf-8")).hexdigest()
    summary = (qa_name, qa_uuid, PREFERENCES_KEY, hash_before, len(blocks), len(repeat))
    if not blocks:
        return CleanupPlan(*summary)
    updated = {**prefs, "blocks": []}
    new_body = json.dumps(updated, ensure_ascii=False, separators=(",", ":"))
    # Field-level preservation is explicit: only the retired 'blocks' member
    # changes. The physical row's revision and every repeat interval survive.
    if updated["revision"] != prefs["revision"] or updated["repeatMonths"] != prefs["repeatMonths"]:
        raise ValueError("NON_AVAILABILITY_DATA_CHANGED")
    return CleanupPlan(*summary, GUARDED_UPDATE,
                       (new_body, new_timestamp, PREFERENCES_KEY, old_body))
