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

    def test_recovery_paid_url_flag_never_proves_payment(self):
        source = (REPO / PATHS[1]).read_text(encoding="utf-8")
        self.assertIn("e.signed_at AS signedAt", source)
        self.assertIn("Boolean(row.acceptedAt&&row.signedAt)", source)
        self.assertIn("Number.isSafeInteger(value)&&value>=0", source)
        self.assertIn('const showRecordedSuccess=paid==="1"&&row.status==="completed"&&balance===0&&!paymentReviewPending;',source)
        self.assertIn("const balance = Math.max(0,row.totalCents-paidCents)",source)
        self.assertIn("showRecordedSuccess ? <div",source)
        self.assertNotIn('paid === "1" ? <div',source)
        self.assertIn('paid==="1"&&!showRecordedSuccess',source)
        self.assertIn('approved&&!paymentReviewPending&&balance>0',source)
        self.assertNotIn('After approval, the 50% deposit',source)

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

    def test_dr_checkout_is_explicit_test_only_and_reserves_before_provider(self):
        source = (REPO / PATHS[2]).read_text(encoding="utf-8")
        self.assertIn("const sandboxTarget = true;", source)
        self.assertIn('runtime.FIRE_STRIPE_MODE !== "test"', source)
        self.assertIn('!/^(sk|rk|rkcs)_test_/', source, "Only TEST key types may be used")
        self.assertIn('if(session.id.startsWith("fire-creating:"))', source)
        self.assertIn("checkoutUncertain:true", source, "Ambiguous Stripe responses must retain the reservation")
        self.assertIn('"Idempotency-Key":`fire-checkout-${reservationId}`', source)
        self.assertIn("if(await expireTrackedCheckout(data.id,stripeKey))await releaseReservation();", source)
        self.assertLess(source.index("const locked=await env.DB.prepare"),
                        source.index('await fetch("https://api.stripe.com/v1/checkout/sessions"'),
                        "Atomic D1 reservation must precede any provider POST")
        self.assertIn("FROM estimates e WHERE e.id=? AND e.share_token=?", source)
        self.assertIn(".bind(row.id,shareToken).first<", source)
        self.assertIn("AND share_token=? AND status IN ('approved','scheduled','completed')", source)
        self.assertIn(".bind(reservationId,row.id,paymentType,chargeAmount,new Date().toISOString(),row.id,row.id,shareToken).run()",source)
        self.assertIn("UPDATE payment_checkout_sessions SET id=?",source)
        self.assertNotIn("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,?,?, 'open', ?)",source,
          "Legacy post-Stripe reservation would allow concurrent second checkout")

    def test_dr_atomic_checkout_sql_blocks_stale_links_and_double_session(self):
        source = (REPO / PATHS[2]).read_text(encoding="utf-8")
        match = re.search(r"const locked=await env\.DB\.prepare\(`(INSERT INTO payment_checkout_sessions .*?)`\)",
                          source,re.S)
        self.assertIsNotNone(match,"Use the actual atomic INSERT SELECT from DR route")
        sql = match.group(1)
        self.assertIn("share_token=?", sql)
        db=sqlite3.connect(":memory:")
        try:
            db.executescript("""
            CREATE TABLE estimates(id TEXT PRIMARY KEY, customer_id TEXT,
              share_token TEXT, status TEXT,accepted_at TEXT,signed_at TEXT);
            CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,total_cents INTEGER);
            CREATE TABLE payment_checkout_sessions(id TEXT PRIMARY KEY,estimate_id TEXT,type TEXT,amount_cents INTEGER,status TEXT,created_at TEXT);
            CREATE UNIQUE INDEX one_open ON payment_checkout_sessions(estimate_id) WHERE status='open';
            INSERT INTO estimates VALUES('a','customer-a','alpha-original','approved','signed','signed');
            INSERT INTO estimates VALUES('b','customer-b','bravo-original','approved','signed','signed');
            INSERT INTO estimates VALUES('c','customer-a','charlie-original','approved','signed','signed');
            INSERT INTO estimates VALUES('d','customer-a','delta-original','approved','signed','signed');
            INSERT INTO estimates VALUES('e','customer-a','epsilon-original','approved',NULL,NULL);
            INSERT INTO invoices VALUES('i-d','d','customer-b',77777);
            """)
            def lock(session,estimate,token):
                return db.execute(sql,(session,estimate,'deposit',10000,'synthetic-now',estimate,estimate,token)).rowcount
            self.assertEqual(lock('first-alpha','a','alpha-original'),1)
            self.assertEqual(lock('second-alpha','a','alpha-original'),0,"One open checkout per estimate")
            self.assertEqual(lock('first-bravo','b','bravo-original'),1,"Distinct customer may pay independently")
            db.execute("UPDATE estimates SET share_token='charlie-rotated' WHERE id='c'")
            self.assertEqual(lock('stale-charlie','c','charlie-original'),0,"Revoked link never reserves")
            self.assertEqual(lock('current-charlie','c','charlie-rotated'),1)
            self.assertEqual(lock('bad-invoice','d','delta-original'),0,"Wrong-customer invoice never reserves")
            self.assertEqual(lock('unsigned','e','epsilon-original'),0,"Unsigned estimate never reserves")
            count=db.execute("SELECT COUNT(*) FROM payment_checkout_sessions").fetchone()[0]
            self.assertEqual(count,3,"Only three authorized synthetic reservations remain")
        finally:
            db.close()

    def test_all_disaster_recovery_financial_post_routes_fail_closed(self):
        # Explicit TEST opt-in must protect every DR financial POST route,
        # not checkout alone. GET payment history remains read-only.
        refund = (REPO / "fire-app-dr/app/api/payments/refund/route.ts").read_text(encoding="utf-8")
        webhook = (REPO / "fire-app-dr/app/api/payments/webhook/route.ts").read_text(encoding="utf-8")
        payments = (REPO / "fire-app-dr/app/api/payments/route.ts").read_text(encoding="utf-8")
        for name, source in (("refund",refund),("webhook",webhook)):
            with self.subTest(name=name):
                post = source[source.index("export async function POST("):]
                self.assertIn('FIRE_STRIPE_MODE',post)
                self.assertIn('_test_',post)
                self.assertIn('cache-control',post)
                self.assertLess(post.index("FIRE_STRIPE_MODE"),
                    post.index("request.json()") if name=="refund" else post.index("request.text()"),
                    "TEST-only guard must precede all request-triggered financial actions")
        owner_post=payments[payments.index("export async function POST("):]
        self.assertLess(owner_post.index('FIRE_STRIPE_MODE'),owner_post.index("request.json()"))
        self.assertIn('FIRE_STRIPE_MODE!=="test"',owner_post)
        self.assertIn("export async function GET()",payments,"Read-only owner payment history preserved")
        self.assertIn('! /^(?:sk|rk|rkcs)_test_'.replace('! ','!'),
                      refund,"Refunds must reject live Stripe keys")
        self.assertIn('! /^(?:sk|rk|rkcs)_test_'.replace('! ','!'),
                      webhook,"Signed webhook processing must reject live Stripe keys")

    def test_recovery_signed_six_events_and_failed_payment_alert_do_not_mutate_ledger(self):
        source=(REPO / "fire-app-dr/app/api/payments/webhook/route.ts").read_text(encoding="utf-8")
        post=source[source.index("export async function POST("):]
        self.assertIn("verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)",post)
        self.assertIn("event.livemode!==false",post)
        self.assertIn("signedObject.livemode!==false",post)
        self.assertLess(post.index("event.livemode!==false"),post.index("recordRefundUpdate("))
        self.assertLess(post.index("event.livemode!==false"),post.index("alertFailedCheckout("))
        for event in ("refund.created","refund.updated","refund.failed",
                      "checkout.session.completed","checkout.session.async_payment_succeeded",
                      "checkout.session.async_payment_failed"):
            self.assertIn(event,post)
        start=source.index("async function alertFailedCheckout(")
        end=source.index("async function recordCheckoutPayment(",start)
        failure=source[start:end]
        for required in ("^cs_test_","session.currency!==\"usd\"",
                         "session.payment_status!==\"unpaid\"",
                         "session.client_reference_id!==estimateId",
                         "fire_checkout_reservation_id",
                         "saved.status===\"paid\"",
                         "saved.status!==\"open\"",
                         "provider_id IN (?,?)",
                         "INSERT OR IGNORE INTO notifications",
                         "payment_failed","SELECT id FROM notifications WHERE id=?"):
            self.assertIn(required,failure)
        self.assertNotIn("UPDATE payments",failure,
                         "A signed failure must never create/alter a paid ledger entry")
        self.assertNotIn("UPDATE payment_checkout_sessions",failure,
                         "A signed failure must not release an uncertain checkout reservation")
        self.assertNotIn("DELETE FROM payment_checkout_sessions",failure)

    def test_failed_checkout_alert_sql_is_idempotent_for_two_synthetic_customers(self):
        # SQL is taken from the current recovery webhook source, not an
        # independently invented financial INSERT.
        source=(REPO / "fire-app-dr/app/api/payments/webhook/route.ts").read_text(encoding="utf-8")
        failure=source[source.index("async function alertFailedCheckout("):
                       source.index("async function recordCheckoutPayment(")]
        expression=re.search(r'("INSERT OR IGNORE INTO notifications \(id,type,title,body,customer_id,estimate_id,created_at\) VALUES \(\?,\?,\?,\?,\?,\?,\?\)")',failure)
        self.assertIsNotNone(expression,"Exact idempotent source INSERT must be present")
        sql=expression.group(1)[1:-1]
        db=sqlite3.connect(":memory:")
        try:
            db.executescript("""
            CREATE TABLE notifications(id TEXT PRIMARY KEY,type TEXT,title TEXT,
              body TEXT,customer_id TEXT,estimate_id TEXT,created_at TEXT);
            CREATE TABLE payments(id TEXT PRIMARY KEY,provider_id TEXT,status TEXT);
            INSERT INTO payments VALUES('already-paid','cs_test_paid','paid');
            """)
            add=('stripe-payment-failed:cs_test_alpha','payment_failed','Failed synthetic Alpha',
                 'Verify recorded payment', 'ca','ea','now')
            self.assertEqual(db.execute(sql,add).rowcount,1)
            self.assertEqual(db.execute(sql,add).rowcount,0,
                             "Replayed signed event must not send another alert")
            bravo=('stripe-payment-failed:cs_test_bravo','payment_failed','Failed synthetic Bravo',
                 'Verify recorded payment','cb','eb','now')
            self.assertEqual(db.execute(sql,bravo).rowcount,1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM notifications").fetchone()[0],2)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM payments").fetchone()[0],1,
                             "Owner alerts do not mutate principal ledger")
        finally:
            db.close()

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
