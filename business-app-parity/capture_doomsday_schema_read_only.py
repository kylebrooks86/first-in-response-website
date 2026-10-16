"""Owner-only Windows metadata capture for FIRE's independent Doomsday D1.

DRY RUN BY DEFAULT.  --capture explicitly performs 10 SELECT-only remote
queries after checking the exact D1 database name and UUID. No writes,
Stripe calls, migrations, exports of customer records, or deployments.

Captures only schema/index/journal definitions and aggregate anomaly counts.
Metadata is owner-supplied, NOT authenticated deployment/binding provenance;
Gate 4/5 remain open regardless of local comparison results.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
TARGET = "fire-app-staging-db"
UUID = "afb2c05a-d794-4a9a-b580-924ce01c26ad"
URL = "https://fire-app-independent-staging.kyle-bfc.workers.dev"
SQL_NAME = "RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql"
# Git blob SHA of the reviewed ten SELECTs at the Oct 15 development checkpoint.
APPROVED_SQL_BLOB = "c931e45dd4d1a177011c73458da7be2dd050e673"
MAX_JSON_BYTES = 2_000_000
MAX_ROWS = 4_000
COLUMNS = (
    {"type", "name", "tbl_name", "sql"},
    {"table_name", "cid", "column_name", "type", "notnull", "dflt_value", "pk"},
    {"table_name", "id", "seq", "parent_table", "child_column", "parent_column", "on_update", "on_delete", "match"},
    {"table_name", "index_name", "unique", "origin", "partial", "seqno", "cid", "column_name"},
    {"name"},
    {"foreign_key_violation_count"},
    {"provider_collision_groups"},
    {"invalid_refund_links"},
    {"invalid_succeeded_refund_ledgers"},
    {"over_reserved_refund_payments"},
)


def reviewed_statements(sql_file):
    source = sql_file.read_bytes()
    # Git for Windows may checkout CRLF despite Git storing canonical LF bytes.
    # Normalize *only* CRLF; any actual SQL edit still fails the pinned blob hash.
    normalized = source.replace(b"\r\n", b"\n")
    if b"\r" in normalized:
        raise ValueError("Unrecognized SQL line endings. Stop and review.")
    identity = hashlib.sha1(b"blob " + str(len(normalized)).encode() + b"\0" + normalized).hexdigest()
    if identity != APPROVED_SQL_BLOB:
        raise ValueError("Reviewed SQL query-file checksum changed. Stop; review before running.")
    content = normalized.decode("utf-8")
    statements = [s.strip() for s in re.sub(r"(?m)^\s*--[^\n]*$", "", content).split(";") if s.strip()]
    if len(statements) != 10 or any(not re.match(r"^SELECT\s", s, re.I) for s in statements):
        raise ValueError("The reviewed SQL must contain exactly ten SELECT-only statements.")
    return statements


def run_wrangler(wrangler, args):
    try:
        proc = subprocess.run([wrangler, *args], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("Wrangler unavailable or timed out; stopped without an accepted capture.") from None
    if proc.returncode != 0:
        # Never echo CLI logs; they can contain account/session information.
        raise RuntimeError("Cloudflare CLI returned an error; stopped. Confirm authentication and target.")
    if len(proc.stdout.encode("utf-8")) > MAX_JSON_BYTES:
        raise RuntimeError("Oversized CLI output; refusing possible private-data disclosure.")
    try:
        return json.loads(proc.stdout)
    except (json.JSONDecodeError, TypeError):
        raise RuntimeError("Unexpected CLI JSON output. Nothing accepted; no private logs printed.") from None


def checked_inventory(payload):
    if not isinstance(payload, list):
        raise ValueError("Unexpected D1 inventory response; stopped.")
    matched = [x for x in payload if isinstance(x, dict) and x.get("name") == TARGET and x.get("uuid") == UUID]
    if len(matched) != 1:
        raise ValueError("Exact Doomsday database name and UUID were not confirmed; stopped.")
    if sum(isinstance(x, dict) and x.get("name") == TARGET for x in payload) != 1:
        raise ValueError("Duplicate same-named D1 inventory entries; stopped.")


def checked_rows(payload, index):
    # Wrangler d1 execute --json returns a one-element array of query results.
    if not isinstance(payload, list) or len(payload) != 1 or not isinstance(payload[0], dict):
        raise ValueError(f"Query {index} result shape unexpected or truncated.")
    obj = payload[0]
    if obj.get("success") is not True or not isinstance(obj.get("results"), list):
        raise ValueError(f"Query {index} failed or returned no result array.")
    rows = obj["results"]
    if len(rows) > MAX_ROWS:
        raise ValueError(f"Query {index} exceeded metadata row limit.")
    expected = COLUMNS[index - 1]
    if any(not isinstance(row, dict) or set(row) != expected for row in rows):
        raise ValueError(f"Query {index} returned unexpected columns; refusing possible private data.")
    if index <= 4 and not rows:
        raise ValueError(f"Query {index} unexpectedly returned no schema metadata; capture incomplete.")
    if index >= 6:
        if len(rows) != 1 or type(next(iter(rows[0].values()))) is not int or next(iter(rows[0].values())) < 0:
            raise ValueError(f"Query {index} did not return exactly one valid nonnegative integer count.")
    if index == 5:
        names = [r["name"] for r in rows]
        if (len(names) != 22 or len(set(names)) != 22
                or [int(name[:4]) for name in names if re.match(r"^[0-9]{4}_", name)] != list(range(22))
                or names[0] != "0000_wise_namora.sql"
                or names[-1] != "0021_manual_processing_fees.sql"):
            raise ValueError("Doomsday journal is not the expected ordered 0000-0021 baseline. Stop.")
    return rows


def checked_cli_stage(wrangler, args, stage):
    """Report only the failed *stage*, never raw CLI stdout/stderr or tokens."""
    try:
        return run_wrangler(wrangler, args)
    except RuntimeError as error:
        raise RuntimeError(f"{stage}: {error}") from None


def cli_safe_statement(statement):
    """Use a single physical line for Wrangler's --command argument.

    The reviewed SQL blob is pinned. Its line breaks are formatting between
    SQL tokens, never SQL string values; do not alter SQL text beyond replacing
    line breaks with ASCII spaces, or relax any checked result expectations.
    """
    return statement.replace("\r\n", " ").replace("\n", " ")


def capture(wrangler, statements, output_dir):
    if not output_dir.is_dir():
        raise ValueError("Choose an existing private destination folder.")
    inventory = checked_cli_stage(wrangler, ["d1", "list", "--json"], "Initial D1 inventory")
    checked_inventory(inventory)
    # Explicit temporary config pins the exact reviewed D1 UUID. No Worker name,
    # deploy target, routes, secrets, or writable SQL are included.
    with tempfile.TemporaryDirectory(prefix="fire-meta-") as temporary:
        config_path = Path(temporary) / "wrangler.json"
        config_path.write_text(json.dumps({
            "name": "fire-owner-metadata-capture-only", "compatibility_date": "2026-10-15",
            "d1_databases": [{"binding": "DB", "database_name": TARGET, "database_id": UUID}],
        }), encoding="utf-8")
        results = []
        for i, statement in enumerate(statements, 1):
            payload = checked_cli_stage(wrangler, ["d1", "execute", TARGET, "--remote", "--json",
                                                    "--config", str(config_path), "--command", cli_safe_statement(statement)],
                                        f"Remote SELECT {i}/10")
            results.append({"rows": checked_rows(payload, i)})
    # Repeat inventory to detect an account/target change during capture.
    checked_inventory(checked_cli_stage(wrangler, ["d1", "list", "--json"], "Final D1 inventory"))
    # This is intentionally an incomplete provider identity declaration:
    # these values require separately authenticated active Worker evidence.
    result = {
        "format": "fire-read-only-d1-schema-v1", "captures": [{
            "target": "doomsday", "url": URL,
            "capturedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "providerMetadata": {"binding": "DB", "databaseUuid": UUID,
                                 "activeVersion": "", "sourceCommit": "", "providerRecordId": ""},
            "truncated": False, "queries": results,
        }],
    }
    encoded = json.dumps(result, indent=2, ensure_ascii=True)
    if len(encoded.encode("utf-8")) > MAX_JSON_BYTES:
        raise ValueError("Metadata capture exceeded maximum size. Nothing saved.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    output = output_dir / f"FIRE-DOOMSDAY-METADATA-ONLY-{stamp}.json"
    with output.open("x", encoding="utf-8") as stream:
        stream.write(encoded + "\n")
    return output, [len(x["rows"]) for x in results]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Run the read-only Cloudflare metadata capture")
    parser.add_argument("--folder", type=Path, default=Path.home() / "FIRE-Private-Backups",
                        help="Existing owner-only folder for metadata receipt")
    args = parser.parse_args()
    try:
        statements = reviewed_statements(ROOT / SQL_NAME)
        print(f"FIRE Doomsday read-only schema capture: {len(statements)} reviewed SELECTs.")
        print(f"Pinned D1: {TARGET} ({UUID})")
        if not args.capture:
            print("DRY RUN: no Cloudflare request, SQL execution, or file created.")
            return 0
        wrangler = shutil.which("wrangler.cmd")
        if wrangler is None:
            raise ValueError("wrangler.cmd not installed or unavailable in PATH.")
        prompt = input(f"Type CAPTURE {UUID} to run ten remote SELECTs on this exact database: ")
        if prompt != f"CAPTURE {UUID}":
            raise ValueError("Full exact-UUID confirmation absent. No remote SQL executed.")
        path, counts = capture(wrangler, statements, args.folder)
        print("Ten SELECT-only metadata queries completed; remote database not modified.")
        print("Rows per query (schema definitions, migration names, aggregate counts only): " + str(counts))
        print("Private metadata receipt: " + str(path))
        print("Not deployment provenance, complete target isolation, migration permission, or Gate 5 acceptance.")
        return 0
    except (ValueError, RuntimeError, OSError, UnicodeError) as error:
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
