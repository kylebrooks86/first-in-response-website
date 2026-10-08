# FIRE Business App — LIVE synchronization handoff (2026-10-08)

Status: PREPARATION ONLY — not approval to deploy or modify LIVE.

## Boundaries
- Independent DR source branch: `fire-calculator-exact-live-clone`.
- Independent DR Worker: `fire-app-independent-staging`; isolated D1 `fire-app-staging-db`.
- LIVE Business App must be audited in its own ChatGPT Work environment before implementing any missing features.
- Preserve existing LIVE customer, estimate, invoice, payment, refund, agreement, and Stripe records.
- No live payment/refund testing; use only sandbox and synthetic records.
- Never promote DR wholesale over LIVE; synchronize approved features individually.
- Do not modify Doomsday deployment during LIVE work.

## Owner-approved, pending LIVE synchronization
1. Customer Command Center: Call, Text, Email, Google Maps, Stride, Google Earth, Zillow, property preview.
2. Edit Existing Customer: name, email, phone, service address, lead source; never duplicate customer or rewrite historical documents.
3. Optional final-payment tipping: No tip (default), 5%, 10%, 15%, Custom; final balance only. Keep tip and tip refunds separate from invoice paid, balance, refund and Stripe reconciliation. Percentages based on full invoice. Preserve no-tip deposits and existing flows.

Authoritative feature inventory and blocking statuses: `dr-parity-overlays/FORWARD_SYNC_APPROVED.json`.

## Observed sandbox evidence (Oct 8, 2026)
Read-only Stripe API verification in First In Response Exteriors sandbox (livemode=false):
- Completed and paid Checkout Session: USD 484.00.
- Checkout metadata: balance payment USD 440.00 and optional tip USD 44.00.
- PaymentIntent: succeeded, amount received USD 484.00.
- Linked partial refund: USD 100.00, status succeeded.
- Arithmetic: net retained USD 384.00; invoice principal paid net USD 340.00, tip USD 44.00, principal still due USD 100.00.
- Earlier test checkout sessions of USD 440.00 and USD 484.00 expired unpaid.
- Owner's DR screenshots showed separate balance/tip/refund entries and customer invoice remaining due USD 100.00.
- This is a single observed successful sandbox flow, NOT evidence of full production readiness or replay correctness.

## Required pre-release verification — NOT YET PASSED
- Exercise the same signed Stripe checkout completion event twice in an isolated test environment; assert one principal ledger entry and one tip entry, unchanged totals after second delivery.
- Exercise concurrent duplicate completion delivery, including insert-race branch; assert identical ledger cardinality and amounts.
- Exercise mismatched existing principal/tip rows; verify fail-closed, visible exception and no duplicate write.
- Exercise refund webhook and refund API reconciliation/retry for the same succeeded USD 100.00 sandbox refund; assert exactly one negative principal ledger entry and no tip refund.
- Verify customer invoice and owner payment history after replay, then repeat after cold reload.
- Verify existing LIVE functionality and financial data remain unchanged before release; capture backup and rollback plan.

Static code guards in `scripts/verify-fire-dr-refund-stripe-workflows.py` check source invariants, but are NOT runtime replay tests. Do not label these tests passed until independently executed.

## LIVE deployment handoff checklist
1. Audit LIVE for each approved feature and record present/missing status.
2. Implement only missing behavior, in a reversible staged change.
3. Run isolated unit/integration tests and Stripe sandbox payment/refund/replay tests.
4. Verify mobile/iPhone workflows, customer data preservation, and existing Stripe accounting.
5. Record evidence for each parity matrix state; do not mark FULL_IDENTICAL from code similarity alone.
6. Obtain explicit owner approval before production promotion. Preserve LIVE rollback and leave independent Doomsday untouched.

## Deferred user-facing polish
DR customer invoice has clickable Cash App `$FIREExteriors` and Venmo `@FirstInResponseExteriors` cards; owner payment history displays amounts, shortened Stripe references, and Copy. These are observed DR improvements but not automatically approved for LIVE promotion. Audit LIVE and request scope approval before treating them as parity requirements.
