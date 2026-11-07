"""OFFLINE ONLY: rehearse all current FIRE migrations against fresh in-memory SQLite.

NO Cloudflare, Wrangler, Stripe, network, uploaded backup or real customer data.
This is NOT an authorization or a remote D1 migration / restore receipt.
"""
from pathlib import Path
import sqlite3
import re

root = Path(__file__).resolve().parents[2]
folder = root / "adapters" / "doomsday" / "drizzle"
migrations = sorted(folder.glob("[0-9][0-9][0-9][0-9]_*.sql"))
expected = list(range(25))
indices = [int(p.name[:4]) for p in migrations]
if indices != expected:
    raise SystemExit(
        f"STOP: expected the complete 0000–0024 schema; found {indices}"
    )
connection = sqlite3.connect(":memory:")
connection.execute("PRAGMA foreign_keys=ON")
for path in migrations:
    sql = path.read_text(encoding="utf-8")
    if not sql.strip():
        raise SystemExit(f"STOP: empty migration {path.name}")
    try:
        connection.executescript(sql)
    except sqlite3.Error as exc:
        raise SystemExit(f"STOP: offline migration {path.name} failed: {exc}") from exc
assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
names = {
    row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )
}
required_tables = {
    "customers", "estimates", "invoices", "payments",
    "payment_refunds", "payment_checkout_sessions",
    "deposit_policy_events", "deposit_agreement_snapshots",
}
if not required_tables.issubset(names):
    raise SystemExit("STOP: required FIRE schema tables missing: " +
                     ", ".join(sorted(required_tables - names)))
index = connection.execute(
    "SELECT COUNT(*) FROM sqlite_master "
    "WHERE type='index' AND name='idx_payments_stripe_provider_unique'"
).fetchone()[0]
assert index == 1, "Stripe provider idempotency index absent"
for table in required_tables:
    assert connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
print(
    "PASS: 25 ordered migrations imported into offline fresh SQLite; "
    "payment/refund/deposit schema and Stripe uniqueness index found. "
    "No Cloudflare/D1/Stripe writes."
)
connection.close()
