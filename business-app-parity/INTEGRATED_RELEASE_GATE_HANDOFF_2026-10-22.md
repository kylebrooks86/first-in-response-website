# FIRE Business App — integrated candidate evidence handoff (read-only)

## Fresh hosted verification addendum — October 22, 2026

See `HOSTED_RELEASE_ACCEPTANCE_20261022.md` and its sanitized JSON receipt.
Fresh service-authenticated `/api/app-version` reads returned LIVE `105` and
refund staging `refund-staging-ebc670f`; fresh Sites `DB` inventories report
18/19 tables respectively, with LIVE `payment_refunds` still absent. Full
runtime SHA/artifact/routing and physical UUID/DDL/index/journal proof remain
unavailable. Doomsday lacks a current authorized provider connection here.
The historical findings below remain retained references; the new checklist
keeps all seven pending gates unchecked. Readiness remains **3/10 (30%)**.

**State: NOT ACCEPTED FOR HOSTED RELEASE.** Source-only integration candidate:
`21e6aa66ac7db97155452f337a040cc0fbf86f77`, [draft PR #32](https://github.com/kylebrooks86/first-in-response-website/pull/32).
The exact-source [eight-job test run #39888668263](https://github.com/kylebrooks86/first-in-response-website/actions/runs/39888668263) passed **8/8**. This is NOT a deployed app or provider identity.

Official owner approval/release readiness: **3/10 (30%)**; issue #19 is authoritative. No merger, deployment, remote migration, Stripe, real customer record write, communication or original backup overwrite was authorized.

## Why the first two hosted gates are still blocked

The last stored provider-looking historical release table is dated **October 9, 2026**, not this integrated candidate. Treat all details as stale until rechecked from the exact current deployment.

| Target | Historical source identity only | Recorded table names | Missing required proof |
| --- | --- | --- | --- |
| LIVE | Old saved version/source different from current GitHub candidate | 18; `payment_refunds` historically missing | Current exact runtime version/build and physical D1 binding; full schema/types/indexes/journal; reconcile missing table without changing anything |
| Refund staging | Old saved version/source different from current candidate | 19 names | Current running version, immutable physical DB UUID, source/build seal, complete schema and journal; names alone do not establish compatibility |
| Doomsday/DR | Historical Worker identity; no independently verified running commit | Not freshly verified | Fresh provider-authenticated active version and exact `DB` UUID; do not assume the old source SHA or any existing Cloudflare account database is equivalent |

**Do not** infer that a recorded 18-table LIVE inventory is still current or that a migration must be applied. Full gate evidence needs fresh, read-only, provider-authenticated results. Existing owner QA iPhone/recovery evidence (October 18–19) is valuable history for a *different QA snapshot*, not physical-device acceptance of this exact integrated commit. Source CI is not a substitute for physically installing and testing the candidate.

## New repeatable offline release evidence review

Run from a checkout of the **exact** candidate; this script makes no provider, database, Stripe or deployment calls:

```sh
python3 business-app-parity/test_review_integrated_release_gates.py
python3 business-app-parity/review_integrated_release_gates.py --candidate-sha 21e6aa66ac7db97155452f337a040cc0fbf86f77
```

The JSON explains stale historical metadata, each target's historical source mismatch/missing schema, all seven missing gate-evidence types and explicit `productionReady:false` / `mergeOrPublicationAuthorized:false`. An exit code **zero** means the **inspector** completed while blocking release. It does NOT mean provider validation or production readiness passed.

For a privately retained **metadata-only** Gate 4/5 provider capture, the same reviewer can apply the existing ten-SELECT strict comparator without contacting hosting:

```sh
python3 business-app-parity/review_integrated_release_gates.py --candidate-sha 21e6aa66ac7db97155452f337a040cc0fbf86f77 --capture /path/outside/git/metadata-only-capture.json
```

Never upload that raw capture, authenticated browser profiles, customer rows, payment rows, backups, access tokens, or secrets to GitHub. This CLI refuses oversized/duplicate-key or nonfinite JSON; the existing technical comparator refuses schema/index/migration mismatches. Even an exactly matching pasted JSON **does not attest provider provenance** and never closes Gate 4 or 5 automatically.

## Next bounded, owner-controlled acceptance actions

1. Refresh read-only **provider-authenticated deployed version, route, source/build digest, physical D1 binding UUID** independently for LIVE, refund staging and Doomsday. Check all are separate resources. Record hashes and redacted provider evidence, not session cookies.
2. For the confirmed **exact** database of each target, collect the ten metadata-only `SELECT` results documented in `RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql`. Compare full DDL/indexes/constraints/journal and anomaly counts with the exact candidate. Do not apply migrations or alter existing tables. Distinguish LIVE's historical `payment_refunds` mismatch from current findings.
3. Confirm real authenticated owner/nonowner/customer-link origin separation, photo storage/R2 bindings and recoverability with safely isolated test identities, never existing customer photos.
4. Physically test the **exact integrated candidate** on owner's iPhone in light/dark, offline cold launch, quote create/reconnect, customer and photo review. Record actual device acceptance separately from synthetic Chrome.
5. In an **isolated sandbox**, reconcile agreement/signature/deposit/scheduling/invoice/refund with exact cents and no real charges or messages. Validate immutable private backups and recovery copies, plus original rollback evidence, before any request for owner authorization.
6. Only with **all ten** gates independently accepted: separately present exact target+commit+migrations+rollback and request explicit owner authorization. **This handoff is not that authorization.**

The unrelated LIVE website verifier failure is separate; it has not been bypassed or weakened.
