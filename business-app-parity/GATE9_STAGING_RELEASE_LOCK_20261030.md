# FIRE Business App — Gate 9 independent-staging / Stripe release lock

**Status: BLOCKED pending authenticated staging access, synthetic provider delivery and exact-cent ledger reconciliation.** This review is scoped to the existing Business App. No public website changes, staging/QA/LIVE deployment, migration, webhook edits, payment, refund or customer messages are authorized here.

## Current known evidence (read-only, October 30, 2026)

- Frozen QA-only candidate: `8ed20dcab617fef214c2178bcf50ea7ba0e119b4`; owner-reported 100% QA Worker version `db6ef897-edd3-439e-8679-b6f6620f18af`. QA is intentionally **Stripe-disabled**; it must NEVER become the staging Stripe destination.
- The connected account is the dedicated **test-mode** FIRE Stripe account. Its existing webhook points at the **legacy Sites** FIRE App origin. It is enabled for three Checkout session events; **refund.created** and **refund.updated** are missing. Do not edit, delete or replay against that endpoint.
- Historical Stripe read-only receipts: five Checkout Sessions (three paid, two expired), three succeeded PaymentIntents, one succeeded $100 refund. The $484 payment represents $440 principal and $44 tip; the refund's principal/tip allocation in the staging database is **not verified**. Stripe events included both refund events, but their existence does not show that FIRE processed them. One historical Checkout completion reports `pending_webhooks=1`, not established successful delivery.
- Independent staging source/route, bound physical D1 UUID, ordered migration journal/indexes, owner and unauthenticated access, signing-secret pairing, ledger and rollback are **not currently authenticated** by the tools in this chat. An unauthenticated 404 is not a missing-runtime verdict.

## Offline fail-closed checker (new)

`gate9_staging_preflight.py` screens a **private metadata-only** JSON packet. It **never accesses Cloudflare, Stripe, SQL, GitHub, browser sessions, a backup, a device or a webhook**. No provider credentials or customer/payment rows belong in the packet or the repository.

The packet's exact structure is:

- Top level: `format` = `fire-gate9-staging-readonly-v1`, `capturedAtUtc`, `sourceCommit`, `staging`, `stripe`.
- `staging`: `environment`, `workerOrigin`, `activeSourceCommit`, `activeWorkerVersion`, `activeTrafficPercent`, `boundD1Uuid`, `otherTargetD1Uuids` (live/qa/doomsday), `otherTargetOrigins` (live/qa/doomsday), `schemaAndJournalVerified`, `refundLedgerAndIndexesVerified`, `authIsolationVerified`, `backupAndRollbackVerified`.
- `stripe`: `accountId`, `livemode`, `currency`, `webhookInventoryComplete`, `webhookSigningSecretConfigured`, `webhooks` list. Each webhook has `url`, `status`, `livemode`, `apiVersion`, `events`. Report only presence of the signing secret—never its actual value.

Review privately on a checkout of the **specific candidate**:

```bash
python3 business-app-parity/test_gate9_staging_preflight.py
python3 business-app-parity/gate9_staging_preflight.py \
  --evidence /private/path/staging-readonly-metadata.json \
  --candidate-sha <exact-reviewed-40-character-sha> \
  --expected-staging-origin https://<owner-verified-independent-staging-host>
```

The positive test fixture is **entirely synthetic** and proves only that the checker correctly handles an internally consistent shape. The evaluator refuses stale or future evidence, mismatched commit, non-100%-active Worker, wrong worker origin, reused QA/LIVE/DR origin or D1, absent migration/refund/auth/backup attestations, wrong test account/currency/mode, incomplete or duplicate endpoints, disabled endpoint, wrong API version, and missing Checkout/refund subscriptions. Unknown extra fields (including credential strings), malformed UUIDs, duplicate JSON keys and unsafe URLs are rejected.

CLI status codes: **0** = metadata checklist structurally passes, **1** = metadata checklist blocked by listed mismatches, **2** = invalid/unsafe evidence. **Even exit 0 always reports** `gate9Accepted:false`, `productionReady:false`, `providerAuthenticatedByThisTool:false`, and `paymentOrRemoteWriteAuthorized:false`. Owner-provided checkboxes or JSON never authenticate providers and **never unlock production**.

## Remaining actual Gate 9 acceptance

1. **Provider-authenticated read-only inspection** of a *separate* staging Worker: active source/version at 100%, canonical `SITE_ORIGIN`, exact D1 UUID and complete schema/journal/indexes, distinct from QA, LIVE and DR; verify synthetic-only records, owner/nonowner access, private backups and rollback.
2. **Separate owner approval** for a distinct staging test-mode webhook and any bounded synthetic payment/refund operation, once target isolation is verified. That endpoint must use the confirmed staging HTTPS origin, the correct sandbox account/test key, a matching signing secret, API version `2026-08-26.dahlia` and the five required Checkout/refund subscriptions. **Do not repoint the existing webhook**.
3. **Authenticated staging ledger tests** using synthetic agreement/signature/deposit/schedule/invoice and signed provider events: delivered and delayed events; replay and duplicate idempotency; failed async payments; exact source ID, principal and tip; $100 partial refund allocation and one matching negative ledger row. Reconcile every cent against fresh Stripe test-mode GET receipts. Do not count old receipts as fresh staging acceptance.
4. Gate 10 still needs exact production identities, sealed source/build, immutable private backups, tested rollback and **explicit exact-target owner release authorization**. Do not merge, migrate, deploy or begin real transactions based on this document.

**Official production gates: 3/10 (30%), unchanged.** Source safety verification is progress but is not a hosted release acceptance.
