#!/usr/bin/env python3
"""FIRE DR source-only customer/invoice isolation check. NO provider access.

Runs without Node installs, Cloudflare credentials, Stripe, customer records,
network, writes to GitHub, or backups. Uses synthetic in-memory SQLite only.
"""
import re
import sqlite3
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PATHS = (
    "fire-app-dr/app/estimate/[token]/page.tsx",
    "fire-app-dr/app/pay/[id]/page.tsx",
    "fire-app-dr/app/api/payments/checkout/route.ts",
)
INVOICE = "(SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id=e.customer_id LIMIT 1)"
BAD = "(SELECT COUNT(*) FROM invoices inv WHERE inv.estimate_id=e.id AND inv.customer_id IS NOT e.customer_id)"

class DRInvoiceOwnership(unittest.TestCase):
    def test_recovery_pages_block_cross_customer_invoice_before_payment(self):
        for relative in PATHS[:2]:
            with self.subTest(relative=relative):
                source = (REPO / relative).read_text(encoding="utf-8")
                self.assertIn(INVOICE, source)
                self.assertIn(BAD, source)
                self.assertIn("AS invoiceOwnershipMismatch", source)
                fail_closed = source.index("if(Number(row.invoiceOwnershipMismatch)!==0)")
                self.assertLess(fail_closed, source.index("const itemResult"))
                self.assertIn("Billing ", source[fail_closed:fail_closed+220])
                self.assertNotIn(
                    "SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1",
                    source, "DR must never use another customer's invoice total"
                )

    def test_recovery_checkout_blocks_before_stripe_and_after_acknowledgement(self):
        source = (REPO / PATHS[2]).read_text(encoding="utf-8")
        self.assertEqual(source.count(INVOICE), 2, "Initial and post-provider reads both protected")
        self.assertEqual(source.count(BAD), 2, "Both reads flag mismatched invoice ownership")
        self.assertLess(
            source.index("if(Number(row.invoiceOwnershipMismatch)!==0)"),
            source.index('await fetch("https://api.stripe.com/v1/checkout/sessions"'),
            "Invalid invoice must block before any new Stripe checkout"
        )
        self.assertIn("Number(current.invoiceOwnershipMismatch)!==0", source)
        self.assertNotIn(
            "SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1",
            source
        )

    def test_source_derived_invoice_sql_rejects_mismatched_customer(self):
        # These exact expressions are sourced from the DR route, not invented
        # as a competing implementation.
        source = (REPO / PATHS[2]).read_text(encoding="utf-8")
        self.assertIn(INVOICE, source)
        self.assertIn(BAD, source)
        db = sqlite3.connect(":memory:")
        try:
            db.executescript("""
            CREATE TABLE estimates(id TEXT PRIMARY KEY, customer_id TEXT, total_cents INTEGER);
            CREATE TABLE invoices(id TEXT PRIMARY KEY, estimate_id TEXT, customer_id TEXT, total_cents INTEGER);
            INSERT INTO estimates VALUES('alpha','customer-a',20000);
            INSERT INTO estimates VALUES('bravo','customer-b',24000);
            INSERT INTO invoices VALUES('invoice-a','alpha','customer-b',77777);
            INSERT INTO invoices VALUES('invoice-b','bravo','customer-b',24000);
            """)
            sql = "SELECT COALESCE(" + INVOICE + ",e.total_cents), " + BAD + " FROM estimates e WHERE e.id=?"
            self.assertEqual(db.execute(sql, ("alpha",)).fetchone(), (20000, 1))
            self.assertEqual(db.execute(sql, ("bravo",)).fetchone(), (24000, 0))
            db.execute("UPDATE invoices SET customer_id='customer-a',total_cents=26000 WHERE id='invoice-a'")
            self.assertEqual(db.execute(sql, ("alpha",)).fetchone(), (26000, 0))
        finally:
            db.close()

if __name__ == "__main__":
    unittest.main(verbosity=2)
