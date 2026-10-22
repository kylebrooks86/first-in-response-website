# FIRE Business App — exact QA approval and missing-evidence packet (2026-10-22)

**Preparation only. STOP: no hosted migration, deployment, production change, customer-data access or remote write is authorized.**

## Sealed source baseline and proven checks

- Repository: `kylebrooks86/first-in-response-website`
- Development branch: `work/fire-business-app-parity-2026-10-08`
- Candidate source commit reviewed: `83f7542ac6d80a69f3052b1d4b16e538a9c53653`
- GitHub Actions: `39781208799`, completed **success** (8/8 jobs). Do not substitute an earlier run or imply future commits share this result.
- Local built-Worker `--job-closeout` end-to-end exercise: completed on disposable synthetic data; includes job completion, exact paid principal, prepared review message, explicit confirmed send, due reminder, exact customer navigation, owner-recorded review and reminder clearing. See `JOB_CLOSEOUT_END_TO_END_20261022.md`. This is not hosted QA or physical iPhone acceptance.
- Existing backup restoration, original 23-migration verification, and disposable 23→25 rehearsal are already owner-observed completed. **Do not repeat export, restore or migration rehearsal merely to refresh paperwork.**
- Official release acceptance remains **3/10 gates (30%)**; this packet does not advance a gate.

## Exact isolated QA target (owner-observed October 19, not independently reauthenticated here)

| Field | Expected value |
| --- | --- |
| Cloudflare Worker | `fire-fullapp-qa-20261016` |
| Serving Worker version | `58a467fa-9dbc-45a3-971e-b5a4e478f54d` |
| Traffic | one version, 100% |
| D1 binding | `DB` |
| D1 database name | `fire-fullapp-qa-db-20261016` |
| D1 UUID | `8ccfb1f8-1657-4074-b1b2-47de78f95003` |
| Hosted journal | 23 entries; final `0022_stripe_provider_uniqueness.sql` |
| Pending additive migrations | `0023_deposit_policy_events.sql` then `0024_deposit_agreement_snapshots.sql` |
| Previous historical version | `5e44f843-94f0-4ea4-b80f-a889bd0830ef` (historical, **not** automatically the next code rollback) |

The currently serving version is an **expected identity to reauthenticate**, not a guarantee that Cloudflare has not changed. Any mismatch, split traffic, wrong D1 binding or unexpected journal/schema is a **STOP**; do not silently repin.

## Existing backup evidence — custody/retention attestation ONLY

Do not request or upload the private SQL, rerun its export, overwrite its hash or repeat the completed restore. Owner should confirm the following from **existing** private records, with redacted paths and sanitized metadata:

- [ ] Original preserved SQL export's recorded timestamp and original SHA-256 are identified.
- [ ] Existing successful restore-review receipt and schema-capture/review receipt are identified with their timestamps and integrity checks.
- [ ] First copy remains encrypted, access-controlled, recoverable, and stored outside this repository.
- [ ] Second **independent** encrypted/access-controlled recoverable copy exists on separate failure-domain storage (not a second directory on the same disk or a GitHub artifact).
- [ ] Both existing copy hashes match the originally recorded SHA-256; record **MATCH / MISMATCH**, not backup contents.
- [ ] Owner attests to access/recovery ownership and confirms the backup recovery point is still appropriate for the planned quiet QA window; changed QA data requires a separately approved fresh recovery checkpoint rather than a silent stale restore.

**Outstanding, not invented:** literal original hash, export timestamp, receipt identity/time, second-copy match and retention attestation. Successful disposable local restore proves recoverability, **not** retention, second-copy custody or remote rollback.

## Authenticated Cloudflare provenance — read-only evidence ONLY

Use the existing capture and receipts when still fresh; do not repeat them solely for documentation. Before a future authorized action, reviewer must possess sanitized owner-authenticated evidence for:

- [ ] Correct Cloudflare account/context and exact isolated QA Worker.
- [ ] Exactly one serving version `58a467fa-9dbc-45a3-971e-b5a4e478f54d` at 100% traffic.
- [ ] That **serving version's** actual `DB` binding points to UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003` (D1 inventory alone is insufficient).
- [ ] Existing hosted schema capture's SHA-256, capture time, reviewer receipt and owner attestation that it came from this authenticated account/database.
- [ ] Read-only journal/schema review matches exactly 23 prior migrations and the two pending migrations, with no unexpected drift.
- [ ] Evidence age within the guarded reviewer's **24-hour** freshness limit at execution; refresh **read-only identity/schema** only if expired or changed, never the completed backup restore.

The original capture intentionally has `providerSourceAttested=false`; a local schema PASS does not turn this into authenticated Cloudflare proof. Owner observations in `QA_OWNER_IDENTITY_RECONCILIATION_20261019.json` are explicitly not independent agent access.

## Migration hashes, scope and separate approvals (NOT GRANTED)

- `0023_deposit_policy_events.sql`: SHA-256 `b117d357a44c2ef3801e15eccd3a67bd82f701984b7658acf5d575fccb362a99`
- `0024_deposit_agreement_snapshots.sql`: SHA-256 `95a1ed3148cd0eee936ad2f8e69323c8a0f8243df226a00973adc04fbab0808e`
- Changes: two append-only audit/snapshot tables, two indexes, four immutability triggers; no intended rewrite of original rows.
- The existing guarded updater `qa_guarded_update.py` requires distinct exact migration and publication approval strings, bound to the same candidate, compiled build digest, verified recovery receipt, account/target, authenticated evidence, quiet window, migration hashes and expected code rollback version. **Neither approval string has been issued.**
- A code rollback does not reverse schema changes or recover database writes. No automatic remote rollback, reset, import or table deletion.

## Approval decision sheet — fill only after all prerequisites

| Gate | Current decision | Evidence required to change it |
| --- | --- | --- |
| Source/CI | PASS for the specified commit/run | Exact immutable commit, 8/8 jobs, clean materialization and sealed build digest |
| Local complete closeout | PASS locally only | Existing built-Worker synthetic run; retain its exact evidence |
| Private backup recoverability | Owner-observed PASS | Existing original hash and restore receipt, **not** a repeat |
| Backup retention/custody | **OPEN** | Two independent secure copies, original SHA matches, timestamps/receipts and owner attestation |
| Cloudflare deployed identity/binding | **OPEN** | Authenticated exact Worker/version/100%-traffic/DB UUID proof |
| Cloudflare schema capture provenance/freshness | **OPEN** | Authenticated origin, capture hash/time, reviewed schema, 24h freshness |
| Final release candidate/build seal | **OPEN** | Exact candidate and build artifact digest from approved checkout |
| Migration authorization | **NOT GRANTED** | Separate exact owner approval after guarded read-only preflight |
| QA code publication authorization | **NOT GRANTED** | Separate exact owner approval after migration receipt |
| Hosted QA and physical iPhone acceptance | **NOT TESTED** | Authorized isolated QA publication followed by synthetic owner iPhone tests |

**Decision: STOP / evidence collection only.** No approval is implied by this file or by the user's request to prepare a packet.

## Owner-facing minimum safe evidence response

Provide only: (1) original backup hash **match status** for both independent secure copies; original export/restore receipt timestamps and storage-retention attestation, (2) authenticated QA Worker active version/traffic and deployed DB UUID match status, (3) capture timestamp/hash and attestation that the original capture came from the intended Cloudflare account, and (4) whether anything has changed since capture. Redact account identifiers, local personal paths, secrets and customer records. Do not paste the SQL, tokens, authenticated browser profile or unredacted database output.

## Authoritative references

- `QA_OWNER_RELEASE_PACKET_20261019.md`
- `QA_OWNER_IDENTITY_RECONCILIATION_20261019.json`
- `JOB_CLOSEOUT_END_TO_END_20261022.md`
- `JOB_CLOSEOUT_CONFIRMATION_20261022.md`
- `QA_IPHONE_RELEASE_OWNER_HANDOFF_20261019.md`
- `GATE4_PROVIDER_EVIDENCE_REQUEST.md`

The LIVE/refund-staging Sites provenance issue is a **separate Gate 4 concern**; their database identity must not be inferred from this independent QA Worker's D1 identity. Do not request the previously completed independent Doomsday binding screenshot again.
