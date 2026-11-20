# QA release review — active-version conflict remains a hard stop

Source implementation candidate: `6d3f7ad9ec4ba4f13eae62f99773d02aa34924cd`.
Parent verified checkpoint: `f24893361ab0c9aa092b6383094ebf3b5ec3cf0e`.
Status: **NOT AN APPROVAL REQUEST; NOT READY TO MIGRATE OR PUBLISH.**

## Version evidence

`QA_MODAL_DEPLOYMENT_20261018_EVIDENCE.json` records owner deployment output showing `58a467fa-9dbc-45a3-971e-b5a4e478f54d` active and `5e44f843-94f0-4ea4-b80f-a889bd0830ef` previous rollback. Its limits explicitly say the current version was owner-output sourced, not independently verified Cloudflare dashboard metadata. The schema capturer and update reviewer pin the older UUID. Neither file is evidence of the version serving now.

This session opened the Cloudflare dashboard and observed a redirect to `https://dash.cloudflare.com/login`; no signed-in account, deployment metadata, database schema, records, or backup were accessible. Therefore neither pin was changed. Do not rerun a publisher or alter a pin based on this document. Both version and 23-to-25 schema holds remain effective.

The next authenticated **read-only** metadata check is the existing Wrangler command:

```powershell
wrangler deployments status --name fire-fullapp-qa-20261016 --json
```

Independently verify exact Cloudflare account and Worker, current deployment ID, sole active full version UUID and 100% traffic. Also verify that version's metadata and exact isolated D1 binding before changing reviewed expectations. Reject split traffic, missing metadata or changed bindings. Historical version listings, public CSS and a screenshot of an old publisher do not establish the current active version. Do not paste tokens, cookies or credentials into chat.

## Exact proposed migration effects

Target Worker: `fire-fullapp-qa-20261016`.
Target QA D1: `fire-fullapp-qa-db-20261016`, UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`.

The original 23 migration files remain immutable. Only these two additive SQL files are proposed; they create two tables, two indexes and four immutability triggers. They do not update existing estimates, payments or signed agreements. They require the existing estimates table and foreign-key consistency. No SQL has been executed on hosted D1 in this batch.

| File | SHA-256 |
| --- | --- |
| `0023_deposit_policy_events.sql` | `b117d357a44c2ef3801e15eccd3a67bd82f701984b7658acf5d575fccb362a99` |
| `0024_deposit_agreement_snapshots.sql` | `95a1ed3148cd0eee936ad2f8e69323c8a0f8243df226a00973adc04fbab0808e` |

`0023` adds append-only deposit policy events. `0024` adds immutable signed agreement snapshots referencing those events. They are reviewed here only because existing candidate code requires them; no new deposit features were added in this batch. Synthetic rehearsal and drift tests pass locally (6/6 and 11/11 tests); this does not prove the state of the hosted database.

## Recovery and approval requirements still missing

Before any hosted write, collect exact active Worker/binding evidence, verify the original QA schema/journal read-only, and retain a private recoverable QA backup with timestamp, target UUID and file hash. Restore the actual private backup to disposable local storage and verify schema, migration journal, relationship integrity and financial totals without exposing records. Synthetic recovery fixtures cannot substitute for that proof.

Keep the independently confirmed current Worker version available for code rollback. A code rollback does not reverse database changes. These audit tables have immutable rows; do not propose dropping them after use or destroying new signed agreements. If post-migration checks fail, stop writes and review preserved data before any restore. A full restore could lose records written since backup and would require a separately reviewed plan and owner authorization.

Only after these checks pass, prepare an exact approval packet naming candidate commit/build hash, Worker/account/D1, verified active and rollback versions, the two SQL hashes above, backup/restore evidence, migration order, post-checks and rollback limits. Request distinct owner authorization for hosted migration and code update. Current code-only updater must continue to reject 25 migrations; this document authorizes no alternative path.

## Source work completed in this batch

Job Report now locks same-frame repeated save taps, freezes report inputs while saving, resets prior success before another attempt, and prevents premature dismissal. Job Costs prevents dismissal during its existing save/refresh lock, avoiding an orphaned saving state. Both dialogs unlock on settled success/failure. Changes live in shared source inherited by LIVE, staging, Doomsday and QA candidates; deployed parity has not been established.

Verified locally: TypeScript exit 0; report recovery/save tests 359/359 assertions; cost recovery 460/460; cost mobile save 40/40; financial processing regression passes; parity gate regression passes. Report and cost recovery tests are now also CI steps for shared and coordinated candidates. No phone, hosted database, deployment or actual Stripe integration was exercised.

Overall accepted production gates: **3/10 (30%)**. Updated screens deployed to QA in this batch: **0/4**. Updated screens verified on physical iPhone in this batch: **0/4**. Next bounded batch: authenticated version/binding read, then private QA recovery verification and exact approval preparation; otherwise continue a source-only online workflow fix. No background work is implied.
