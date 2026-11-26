# FIRE G4 — STAGING beta Worker API identity mapping (Nov 25, 2026)

## New code (supplemental, NO PROVIDER ACTION)

- Added `business-app-parity/owner_staging_beta_worker_identity_read_only.mjs` on active draft PR #282: only two Cloudflare Workers **GET** calls, first by the existing STAGING Worker **name** and then by the returned Worker **ID**, strictly rejecting mismatched name/ID, malformed provider replies or token. Bounded 96 KiB streamed replies, read-only, no raw provider response/token/binding values displayed. Explicit Windows TTY `--capture` required; default invocation performs zero provider operations.
- Added `business-app-parity/test_owner_staging_beta_worker_identity_read_only.mjs`: positive mapping, mismatch/invalid-ID/provider-error and no-secret-output tests using purely injected mock replies. Existing `.github/workflows/fire-dr-dark-postcreate-readonly.yml` now includes this new focused test. Engineering commits `51f1961`, `2664810`, `b681c40`, `24342cc`.
- Cloudflare's official beta Worker GET endpoint `GET /accounts/{account_id}/workers/workers/{worker_id}` accepts **ID or name**, which is exactly the targeted missing identity relationship. Reference: https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/methods/get/

## Distinct evidence still outstanding

- [ ] An owner-controlled **existing read-only token** on Acer must execute **only this unique two-GET identity check**; token must never be shared in chat, screenshots or GitHub. Running without the existing token stops; **no new Cloudflare browser login**.
- [ ] Exact compiled package-to-source provenance, auxiliary module typing, a new reviewable inactive 0%-traffic STAGING version, independent hosted bytes/secret-name/Stripe-disabled bindings, and the missing 3 physical STAGING D1 migrations remain separate, not accomplished by GET metadata.
- [ ] Original G4-04/G4-07 remain OPEN until their full physical conditions are met. The previous STAGING upload attempt locks are consumed—**never retry or reset**. Existing 100% serving version/deployment, original DB, private Access, credentials, QA, DR, TEST and NEW LIVE are untouched.

**Verified action classification:** source authored and CI wired only. CI at `24342cc` was QUEUED at first read; do not claim targeted or full workflow PASS without readback. No upload/activation, Worker/D1/Stripe provider write, payment, migration, Git merge, R2, or paid subscription. Official original checklist remains **57/95, 38 open; 5/10 gates G1/G2/G3/G7/G8 accepted.** LIVE NO-GO, real Job #0001 unused.
