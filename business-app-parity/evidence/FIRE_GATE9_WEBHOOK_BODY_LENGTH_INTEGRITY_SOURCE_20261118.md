# Nov 18 2026 — Gate 9 signed webhook body-length inconsistency guard (SOURCE ONLY)

## Real defect and correction

Before this PR270 source change, the shared FIRE app Stripe webhook route `shared/app/api/payments/webhook/route.ts` bounded the raw request stream to 1 MiB and rejected oversized **declared** Content-Length, but did not check that a provided Content-Length matched the **actual bytes received**. Thus a signed event with contradictory transmitted size might be acknowledged as valid if its raw-body HMAC matched, rather than refused as an incomplete/inconsistent delivery. This matters for financially sensitive webhook receipt integrity, even though deployed HTTP servers often enforce lengths themselves.

**Actual change** [c32b583](https://github.com/kylebrooks86/first-in-response-website/commit/c32b583cf54170c12dda16418c4ab446e32569a8): the bounded stream reader now requires `actual total === Number(claimed)` if `Content-Length` is present, **before** decoding UTF-8, checking Stripe signature or touching any D1/Stripe reconciliation. Does not change behavior when Content-Length is absent or correctly matches the delivered body. Existing 1 MiB guard, signature timestamp, HMAC, correct-host, Stripe TEST/LIVE isolation and default-disable semantics remain.

**Targeted new cases** [9148d1a](https://github.com/kylebrooks86/first-in-response-website/commit/9148d1aa24509cc13214bcb35d422baea9132cb8) extend the actual route test `shared/scripts/test-webhook-boundary.mjs`, checking synthetic properly signed JSON with three contradictory claimed byte counts (0, actual-1, actual+1). Each must get HTTP 413, no-store and zero payment/refund/failure-reconciliation calls. Existing valid exact Content-Length and zero-padded count tests remain.

**Test evidence status at initial documentation:** [FIRE Staging Migration and Shared-App Parity CI #44454802477](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44454802477) queued/in progress at code/test commit `9148d1aa24509cc13214bcb35d422baea9132cb8`. Check actual workflow/job logs before calling these cases PASS; no provider or customer data used.

## Acceptance constraints

This is **source-only Gate9 request integrity improvement**, not fresh Stripe TEST payment/refund, signed webhook delivery to actually hosted TEST Worker, independent TEST D1 ledger evidence, or release authorization. Gate 9 still OPEN, NEW LIVE stays DARK. Counts remain **50/95 accepted, 45 open, 4/10 formal G1/G2/G3/G8**; G4/G5/G6/G7/G9/G10 OPEN. No Cloudflare login/retry, R2, provider mutation, SQL, Stripe charge/refund, Worker deployment, public website publish, Git merge or production release. The owner's unsuccessful read-only Gate4 Acer attempt is separately sealed and is NOT repeated.
