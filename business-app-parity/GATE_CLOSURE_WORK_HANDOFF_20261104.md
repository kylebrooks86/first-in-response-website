# FIRE Business App — November 4 Work-assisted Gate 4–7 closeout handoff

**Purpose:** drive **real, target-specific hosted evidence** into the existing FIRE Business App release-gate board, not another general UI audit. Prepared Nov 3 while owner away from Acer. This is an **instructions/evidence checklist**, NOT authorization for remote changes. See `RELEASE_CLOSEOUT_2026-11-01.md`, `GATE4_PROVIDER_EVIDENCE_REQUEST.md`, `HOSTED_GATE4_GATE5_METADATA_ACCEPTANCE.md` and GitHub issue #19 before acting. Use existing ChatGPT Work project / authenticated browser if available, or escalate the exact missing provider metadata through the existing hosting provider. Do not invent IDs from project IDs or filenames.

## Scope and last-known immutable IDs (must be checked against provider records)

- Existing LIVE ChatGPT Sites FIRE App: `https://fire-app.kylebrooks8605.chatgpt.site`, Sites project `appgprj_6aaf416f82c88191a292fa2e13a9ea61`. Last known successfully saved deployment `appgdep_6ac6f067e2548191aaf38c28d25c54f5`, saved version 61, source `896b5e4125cb89da729993d1f37127e3b930c79d`, `/api/app-version` previously reported `105`.
- Existing independent LIVE refund-staging ChatGPT Site: `https://fire-live-refund-staging.kylebrooks8605.chatgpt.site`, Sites project `appgprj_6ac7e8e358dc81918d0a47c4034c4a41`. Last known saved deployment `appgdep_6ac7f3e8903481919a5883a2750ccbb8`, saved version 3, source `f7ed28a5d13ada738f5663e4f55a45c5d794c21e`, `/api/app-version` previously reported `refund-staging-ebc670f`.
- Independent Doomsday Worker `fire-app-independent-staging`: already owner-verified physical D1 `afb2c05a-d794-4a9a-b580-924ce01c26ad`, serving version `61fa32a3-3461-469d-9245-a9df6dd3f036` in Oct 16 read-only receipt. **Do not ask for the same physical D1 check again without new risk evidence.**
- Isolated Stripe TEST Worker `fire-stripe-test-20261101`, D1 `dba421ba-fc66-4cf8-9c31-51616f8249ba`, last fully verified 100%-serving version `96e32262-fa33-4f04-a161-bee11f0353e2`. This is separate from LIVE Sites and does NOT solve the LIVE DB mapping. Owner's Nov 3 one-attempt inactive upload stopped on Wrangler CLI option mismatch; **whether a new inactive version exists is not yet verified**.

## Gate 4 fast intake: split provider identity from schema (NEW, offline only)

**Do NOT start with live refund SQL or an extensive iPhone audit.** First read the current existing Sites LIVE/refund-staging serving deployments and their **physical D1 binding UUIDs**, not the project names or saved source numbers. Capture only the following *sanitized metadata* in a **private file outside GitHub**. Set fields the provider cannot supply to `null`; do not guess, create placeholder IDs, include raw API responses, or paste tokens/customer/payment rows. Use exactly the expected two Sites project IDs and URLs already written below.

~~~json
{
  "format": "fire-gate4-sites-identity-v1",
  "captures": [
    {
      "target": "live",
      "projectId": "appgprj_6aaf416f82c88191a292fa2e13a9ea61",
      "url": "https://fire-app.kylebrooks8605.chatgpt.site",
      "provider": "chatgpt-sites",
      "capturedAt": "REPLACE_WITH_ACTUAL_UTC_TIMESTAMP",
      "evidenceRef": null,
      "binding": "DB",
      "physicalD1Uuid": null,
      "servingDeploymentId": null,
      "providerDeploymentId": null,
      "servingArtifactSha256": null,
      "servingSourceCommit": null
    },
    {
      "target": "refund-staging",
      "projectId": "appgprj_6ac7e8e358dc81918d0a47c4034c4a41",
      "url": "https://fire-live-refund-staging.kylebrooks8605.chatgpt.site",
      "provider": "chatgpt-sites",
      "capturedAt": "REPLACE_WITH_ACTUAL_UTC_TIMESTAMP",
      "evidenceRef": null,
      "binding": "DB",
      "physicalD1Uuid": null,
      "servingDeploymentId": null,
      "providerDeploymentId": null,
      "servingArtifactSha256": null,
      "servingSourceCommit": null
    }
  ]
}
~~~

**The JSON above is a template and intentionally NOT valid evidence.** A successful provider metadata read is not automatically a gate acceptance. Feed the PRIVATE sanitized file into:

~~~bash
python3 business-app-parity/preflight_gate4_sites_identity_offline.py /secure/private/fire-gate4-sites-identity.json
~~~

The checker uses no network or hosted database access. It identifies missing physical UUID/artifact/commit/attestation fields individually and rejects unrecognized fields, collisions with known QA/TEST/Doomsday D1 IDs, mismatched Sites IDs/URLs and stale captures. **Even complete self-supplied JSON never passes Gate 4 or 5:** the verifier explicitly outputs `providerProvenanceIndependentlyVerified=false` and `gate4Accepted=false`; independent authenticated provider corroboration is still required.

**Only after actual physical LIVE DB identity and journal access are verified**, run the already reviewed THREE metadata-only SELECTs in `LIVE_REFUND_GAP_READ_ONLY.sql`, then `triage_live_refund_gap.py`. The **full 10-query** candidate verifier may fail legitimately while the LIVE `payment_refunds` table is missing; never interpret that failure as permission to migrate or invent empty results. Gate 5 needs a forensic decision first. All browser/runtime authentications must use existing supported provider sessions; if the immutable Sites UUID or full artifact hash is inaccessible, request the existing `GATE4_PROVIDER_EVIDENCE_REQUEST.md` provider attestation rather than asking the owner to repeat unrelated Cloudflare or QA checks.

## Gate 4 — hosted identity, first priority
With existing project credentials in Work (if possible), read Sites deployment metadata WITHOUT saving/publishing/editing. For each of LIVE and refund staging, return **only**: provider-confirmed current serving deployment ID, version/traffic percent, saved source commit versus actually deployed artifact SHA (or explicit unavailable), environment/route, and actual physical D1 UUID bound as `DB`. Confirm distinct UUIDs between the two and from known Doomsday and QA physical UUIDs. If Sites does not expose the bound UUID or deployed artifact linkage, document the exact unsupported field and use the already prepared `GATE4_PROVIDER_EVIDENCE_REQUEST.md` to request immutable provider attestation. A project ID or runtime version string is NOT a physical DB UUID. Never infer equality or separation.

## Gate 5 — LIVE `payment_refunds` and financial schema
Only **after Gate 4 confirms the physical LIVE database**: read schema/migration metadata from that exact DB using the three previously reviewed SELECT-only queries in `LIVE_REFUND_GAP_READ_ONLY.sql`; save result as private metadata-only evidence. Then, if provider supports safely, collect all ten SELECT-only metadata/anomaly queries in `RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql` for LIVE, refund staging and independent Doomsday (or mark unavailable rather than guessing). Never send rows of customers, payments, tokens, full backups, emails, or personal data to GitHub. Run the source-only `verify_hosted_schema_capture.py` against private metadata; report specific missing table, migration/index journal or anomaly counts. `payment_refunds` previously absent from LIVE table inventory and **must not be assumed fixed**. No migration is authorized.

## Gates 6–7 — parallel evidence, not implementation guesses
Gate 6: collect available provider logs/metadata for owner-only Access, synthetic nonowner/customer-link tests, denied cross-customer sessions and restart/session boundaries; **no use of real customer accounts** or public session tokens. Gate 7: target-bound photo storage configuration, current owner-controlled backup+checksum provenance and restore/rollback receipt; do not repeat previously accepted current25 QA backup/restore or approved photo/ZIP tests. Mark absent hosted evidence as OPEN; do not create remote backups or restore without specific authorization.

## Gate 9 Stripe provider side ALREADY verified — do NOT recreate/reconfigure webhook

On Nov 3, this regular Chat performed fresh first-party connected sandbox **read-only Stripe GETs**. Account `acct_1ULRIG7ND12rd1wI`, `livemode=false`. Complete `/v1/webhook_endpoints` list (`has_more=false`) has **two** enabled endpoints: the **new isolated five-event** `we_1UXYgG7ND12rd1wIB4CmcxGy`, correctly pointing to `fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook` and subscribing to `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated` on API version `2026-08-26.dahlia`; and the untouched three-event legacy FIRE Sites endpoint `we_1ULV3j7ND12rd1wILDuTy79G`.

The COMPLETE sandbox event list returned 21 events with **none** created on or after the new endpoint's `2026-11-03T03:46:40Z` creation. One earlier Oct 8 Checkout event is still pending a webhook, not attributable to the new endpoint. Recorded in `GATE9_STRIPE_PROVIDER_READ_ONLY_20261103.md`. **Do not spend Work/Acer time rerunning the same webhook event-name inventory** unless there is a fresh change. The unsolved Gate 9 work is isolated TEST Worker version and true signed delivery / private ledger reconciliation, *not* webhook creation. No request in this packet authorizes an event trigger, replay, refund, payment or Stripe write.

## Today's source-only Gate 9 blocker
Draft PR #100 fixes the observed `wrangler versions upload --strict` CLI incompatibility by checking standalone owner Wrangler 4.151.0 help/version before any optional write and using that CLI for any separately authorized upload. App-local pinned 4.92.0 remains the offline build/dry-run tool. The owner's last **one-upload authorization was consumed** by the failed CLI-parse attempt. Before requesting another exact one-upload approval, obtain on Acer **read-only** active deployment + complete version inventory to rule out a hidden inactive version. PR #97/PR #100 source CI does not attest to hosted upload.

## Reporting contract
For each gate 4–7, report: **ACCEPTED (exact authenticated evidence source/time/record)** or **OPEN (precise missing field/procedure)**. Do not mark a gate accepted based on source-only tests, copied screenshots, unknown hosted worker identity, or an internally generated fixture. Update GitHub issue #19 with source/target-specific evidence only, and explicitly preserve 3/10 formal gates accepted until Gate 4–10 evidence is genuinely complete. No remote deployments, migrations, schema repair, Stripe/payment activity, secrets access, customer messaging, GitHub PR merges, or website changes are authorized.
