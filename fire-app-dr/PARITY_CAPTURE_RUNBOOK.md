# FIRE App v138 — Strict Parity Capture Runbook

Purpose: reproduce the same disposable UI/business states in both FIRE deployments and compare them against the exact registered evidence bytes.

## Fixture identity
- Customer: `Parity Test Customer`
- All fixture record IDs begin with `parity-`.
- Fixture data is test-only and must never be loaded into the production database.

## Important fixture states
The fixture includes the normal estimate/invoice lifecycle plus:
- draft, sent/viewed, approved/signed, scheduled, completed/partial, and paid states;
- open change request;
- customer notes/messages/tasks;
- payment history;
- open/paid invoices;
- job cost and completed service report;
- before/after photo archive;
- successful partial refund that reopens a completed-job balance;
- pending refund that exercises payment/review/invoice mutation holds.

## Current parity ledger
The evidence ledger contains **32 required parity states**. `PARITY_CAPTURE_QUEUE.md` is generated from that ledger and is the authoritative capture worklist.

## Capture order
Use capture-group order from `PARITY_CAPTURE_QUEUE.md`. For every state:

1. Render the state in the LIVE reference/staging environment.
2. Render the matching state in independent staging.
3. Use the same device class, viewport, orientation, pixel ratio, and fixture state. For states with existing LIVE evidence, match the exact target profile printed in `PARITY_CAPTURE_QUEUE.md`.
4. Register each real screenshot with `parity:evidence:register`, an explicit deployment/session `--source-label`, and the full capture-profile arguments.
5. Compare only after both sides are registered.
6. Save the verdict with `parity:evidence:compare`.
7. Re-run `release:strict-parity`.

Refund states must include:
- Refund payment modal/workflow;
- owner Refund processing hold;
- customer-facing Refund processing state.

## Pass rule
A state is `VERIFIED_IDENTICAL` only after:
- both LIVE and independent evidence files exist;
- both files pass SHA256/size validation;
- an explicit comparison is saved against those exact two hashes;
- visible layout, text, controls, state, and corresponding workflow behavior match.

Similarity is not enough.

## Evidence replacement rule
Replacing either screenshot resets the state to `PENDING`. The old comparison verdict is invalidated automatically.

## Cleanup
Use the parity fixture removal command after capture. It targets only known `parity-*` records and parity photo objects.

## Current unresolved count
Until actual independent captures and comparisons are completed, the strict ledger remains **32 unresolved parity states** and the release status remains `NOT_YET_FULLY_VERIFIED`.


## Progress and comparison queues

Run:

```bash
npm run parity:progress
```

`PARITY_PROGRESS.json` is the machine-readable count summary.

`PARITY_COMPARISON_QUEUE.md` lists only states where both sides are already captured and a comparison verdict is still needed. This prevents comparison work from being mixed with screenshot collection.


## Capture-context pass rule

`VERIFIED_IDENTICAL` requires matching LIVE and independent:
- device class;
- orientation;
- viewport width;
- viewport height;
- pixel ratio;
- screenshot pixel dimensions.

If the context differs, record a mismatch or recapture. Do not visually compare unlike rendering contexts as identical.


## Deployment-release rule

For independent evidence used to prove the current build:
- `source_release` must equal the current recovery release (`v138`);
- `route_family` must match the LIVE evidence/state family;
- an older independent screenshot must be recaptured after a new recovery release before that state can be `VERIFIED_IDENTICAL`.

LIVE evidence may come from the current LIVE master label rather than a numbered recovery release, but its route family must still match the independent state.


## Exact source-package rule — v138

For independent evidence intended to prove this recovery package:
- source release: `v138`
- shared-core fingerprint: `2863f0efd18715c523e8a2adffe172e75c1f8d56e72db1b83b6bd1ed44cb17b9`
- route family: the parity state ID unless explicitly documented otherwise

A newer release requires a new independent capture even if the page looks unchanged.
