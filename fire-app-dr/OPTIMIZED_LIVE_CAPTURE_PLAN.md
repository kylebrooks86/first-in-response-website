# FIRE App v31 — Optimized LIVE Parity Capture Plan

**Master target:** the current LIVE FIRE business app.

The 29 unresolved parity states are grouped into **11 capture sessions** so one controlled LIVE state can satisfy several evidence IDs. This does not mark anything verified automatically; it only minimizes repeated work.

## Capture sessions

### LIVE-01 — Customer profile tabs
Capture one disposable customer profile showing:
- Payments tab
- Invoices tab
- Photos tab
- Before/After photo controls with one disposable before and after image

Closes up to 4 evidence IDs.

### LIVE-02 — Deposit / scheduling behavior
Use a disposable approved estimate. Capture:
- approved state with the 50% deposit still unpaid
- successful Scheduled state while Paid remains $0 (already captured in current LIVE)
- deposit / paid / balance summary
- successful job-date scheduling state

This documents the current LIVE behavior: the 50% deposit is calculated and displayed but is not enforced as a prerequisite for Scheduled status.

### LIVE-03 — Follow-up + payment history
Capture:
- Follow-ups card and Prepare message state
- populated Payment History with at least Cash App and Venmo/manual entries
- any visible safeguards preventing an invalid payment amount/state

### LIVE-04 — Owner invoices
Capture:
- Invoices list
- one owner invoice detail
Prefer a multi-service invoice so service-summary behavior is visible.

### LIVE-05 — Business + Templates
Capture the complete:
- Business screen
- Templates screen

### LIVE-06 — Owner empty/error states
Capture representative empty/error states that actually exist in LIVE. If a listed state is unreachable/nonexistent in LIVE, document that rather than inventing it.

### LIVE-07 — Customer approval/signature + change request
Using disposable customer links, capture:
- approval/signature before action
- completed signed state
- change-request entry state
- submitted change-request state

### LIVE-08 — Customer invoice + payment
Capture:
- customer invoice view
- customer payment page with open/partial balance
- paid invoice / $0 balance state

### LIVE-09 — Stripe test mode
Only after LIVE Stripe test mode exists. Capture/test:
- checkout initiation from an eligible estimate/invoice
- server-calculated expected amount
- successful test checkout
- webhook-recorded FIRE payment
- repeat webhook/session does not duplicate payment

### LIVE-10 — Customer invalid/expired link
Capture the exact LIVE error state for an invalid/expired customer token/link.

### LIVE-11 — Shared calculation/workflow proof
Using disposable records, verify in LIVE:
- multi-service line totals, subtotal, discount, total, 50% deposit
- no duplicate parent rows from multi-service joins
- $150 minimum behavior
- service catalog/manual-price behavior
- final balance remains unavailable until completion

## Capture rules
- Use disposable `parity-*` records only where possible.
- Do not alter real customers to manufacture a state.
- Capture on the same iPhone viewport/orientation used for the LIVE reference whenever the state is mobile.
- A screenshot can satisfy more than one evidence ID only when every required element is clearly visible.
- Do not mark an item VERIFIED IDENTICAL from code alone when its remaining blocker is specifically visual.
- The independent app must adapt to LIVE during this phase; LIVE is the master target.

## Completion
`FULL_IDENTICAL` remains blocked until every evidence entry is VERIFIED IDENTICAL or documented as an infrastructure-only difference with no user-visible or business-functional effect.
