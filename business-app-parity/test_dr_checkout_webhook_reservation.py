"""FIRE DR signed TEST webhook reconciliation regression, source-derived SQL only.
No Cloudflare connections, checkout API calls, customer records or payments.
Only two fictional customers and disposable native SQLite in-memory databases.
"""
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
route = (ROOT / "fire-app-dr/app/api/payments/webhook/route.ts").read_text(encoding="utf-8")
checkout = (ROOT / "fire-app-dr/app/api/payments/checkout/route.ts").read_text(encoding="utf-8")

def exact(pattern, label):
    found = list(re.finditer(pattern, route, re.S))
    assert len(found) == 1, f"Expected exactly one actual DR route {label}, got {len(found)}"
    return found[0].group(1)

read_sql = exact(
    r'const reserved=await env\.DB\.prepare\("([^"]+)"\)\s*\.bind\(reservationId\)',
    "reservation lookup",
)
promote_sql = exact(
    r"const promoted=await env\.DB\.prepare\(\x60([^\x60]+)\x60\)\s*"
    r"\.bind\(session\.id,reservationId,estimateId,paymentType,sessionAmount\)\.run\(\)",
    "guarded in-place promotion",
)
tracked_sql = exact(
    r'const tracked = await env\.DB\.prepare\("([^"]+)"\)\.bind\(session\.id\)',
    "actual Stripe-session readback",
)
estimate_sql = exact(
    r"const estimate = await env\.DB\.prepare\(\x60([^\x60]+)\x60\)"
    r"\.bind\(estimateId\)",
    "saved customer/invoice obligation",
)

assert "WHERE id=? LIMIT 1" in read_sql
assert "UPDATE payment_checkout_sessions SET id=?" in promote_sql
assert "WHERE id=? AND estimate_id=? AND type=? AND amount_cents=? AND status='open'" in promote_sql
assert "WHERE id=? LIMIT 1" in tracked_sql
assert route.index("const reserved=await") < route.index("const tracked = await")
assert "if(!promoted.meta.changes)" in route
assert "checkout_reservation_mismatch" in route
assert "checkout_reservation_promotion_failed" in route
assert "invalid_checkout_reservation" in route
assert r"^cs_test_[a-zA-Z0-9]+$" in route
assert 'session.currency!=="usd"' in route
assert "session.client_reference_id!==estimateId" in route
assert "missing_charge_metadata" in route
assert 'invoice_customer_mismatch' in route
assert "inv.customer_id=e.customer_id" in estimate_sql
assert "inv.customer_id IS NOT e.customer_id" in estimate_sql
assert "fire_checkout_reservation_id" in checkout
assert 'form.set("client_reference_id", row.id)' in checkout
for field in ("expected_amount_cents", "tip_amount_cents", "expected_charge_cents"):
    assert f'form.set("metadata[{field}]"' in checkout

db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row
db.executescript("""
CREATE TABLE payment_checkout_sessions (
  id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,status TEXT NOT NULL
);
CREATE UNIQUE INDEX one_open_checkout ON payment_checkout_sessions(estimate_id)
  WHERE status='open';
CREATE TABLE customers (id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE estimates (
  id TEXT PRIMARY KEY,status TEXT NOT NULL,customer_id TEXT NOT NULL,
  total_cents INTEGER NOT NULL,deposit_cents INTEGER NOT NULL
);
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,customer_id TEXT NOT NULL,
  total_cents INTEGER NOT NULL
);
CREATE TABLE estimate_items (estimate_id TEXT NOT NULL,name TEXT NOT NULL);
""")
A = "alpha-estimate"
B = "bravo-estimate"
ra = "fire-creating:11111111-1111-4111-8111-111111111111"
rb = "fire-creating:22222222-2222-4222-8222-222222222222"
db.executemany(
    "INSERT INTO payment_checkout_sessions VALUES(?,?,?,?,?)",
    [(ra, A, "deposit", 10000, "open"), (rb, B, "balance", 22000, "open")],
)
read = lambda ident: db.execute(read_sql, (ident,)).fetchone()
promote = lambda sid, rid, eid, typ, cents: db.execute(
    promote_sql, (sid, rid, eid, typ, cents)
).rowcount

assert read(ra)["estimateId"] == A
assert read(rb)["estimateId"] == B
# Signed session A must not consume B's previously reserved slot.
assert promote("cs_test_WrongCustomer", rb, A, "balance", 22000) == 0
assert promote("cs_test_WrongAmount", ra, A, "deposit", 10001) == 0
assert promote("cs_test_WrongType", ra, A, "balance", 10000) == 0
assert read(ra)["status"] == "open"
assert read(rb)["status"] == "open"
assert promote("cs_test_Alpha", ra, A, "deposit", 10000) == 1
assert read(ra) is None
assert db.execute(tracked_sql, ("cs_test_Alpha",)).fetchone()["estimateId"] == A
# A retry of the same signed Stripe delivery reads the already-promoted row.
assert read(ra) is None
assert db.execute(tracked_sql, ("cs_test_Alpha",)).fetchone()["status"] == "open"
try:
    promote("cs_test_Alpha", rb, B, "balance", 22000)
    assert False, "Cross-customer reservation cannot reuse another customer session ID"
except sqlite3.IntegrityError:
    pass
assert read(rb)["estimateId"] == B
assert promote("cs_test_Bravo", rb, B, "balance", 22000) == 1
assert db.execute(tracked_sql, ("cs_test_Bravo",)).fetchone()["amountCents"] == 22000
assert db.execute("SELECT COUNT(*) FROM payment_checkout_sessions").fetchone()[0] == 2
# Even an unrelated attempt with a duplicate Stripe ID must not clobber one.
db.execute("INSERT INTO payment_checkout_sessions VALUES(?,?,?,?,?)",
           ("fire-creating:33333333-3333-4333-8333-333333333333", "third", "deposit", 5000, "open"))
try:
    promote("cs_test_Alpha", "fire-creating:33333333-3333-4333-8333-333333333333", "third", "deposit", 5000)
    assert False, "Duplicate Stripe session ID must be rejected by primary key"
except sqlite3.IntegrityError:
    pass
assert db.execute(tracked_sql, ("cs_test_Alpha",)).fetchone()["estimateId"] == A
db.rollback()  # No mutation is retained by this disposable fixture.

# Same actual invoice SQL must ignore a B-owned invoice and flag mismatch
# rather than credit A for B's final balance.
db.executemany("INSERT INTO customers VALUES(?,?)",
               [("customer-a", "Synthetic Alpha"), ("customer-b", "Synthetic Bravo")])
db.executemany("INSERT INTO estimates VALUES(?,?,?,?,?)",
               [(A, "completed", "customer-a", 18000, 9000),
                (B, "completed", "customer-b", 22000, 11000)])
db.execute("INSERT INTO invoices VALUES(?,?,?,?)",
           ("wrong-a-invoice", A, "customer-b", 777777))
wrong = db.execute(estimate_sql, (A,)).fetchone()
assert wrong["invoiceOwnershipMismatch"] == 1
assert wrong["totalCents"] == 18000
assert db.execute(estimate_sql, (B,)).fetchone()["invoiceOwnershipMismatch"] == 0
db.execute("DELETE FROM invoices WHERE id='wrong-a-invoice'")
db.execute("INSERT INTO invoices VALUES(?,?,?,?)",
           ("correct-a-invoice", A, "customer-a", 17500))
valid = db.execute(estimate_sql, (A,)).fetchone()
assert valid["invoiceOwnershipMismatch"] == 0
assert valid["totalCents"] == 17500

print("PASS: DR actual-source guarded reservation SQL, two synthetic customer isolation, "
      "wrong amount/type denial, in-place promotion, signed replay, colliding ID denial, "
      "and cross-customer invoice fail-closed SQL. No provider/remote writes.")
db.close()
