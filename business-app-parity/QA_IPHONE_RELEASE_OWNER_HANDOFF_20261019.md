# FIRE iPhone QA release handoff — read-only owner preparation

> **October 24, 2026 update — this document preserves an older October 19 checkpoint, not current QA status.** The owner has since shown a **single QA Worker version** `ab408776-bf5d-4fab-825e-73082eabbce6` at **100% traffic**, named `DB` binding to `fire-fullapp-qa-db-20261016`, and **25 saved rows** in `d1_migrations`, with `0023_deposit_policy_events.sql` and `0024_deposit_agreement_snapshots.sql` recorded on October 23. **Do not reapply 0023/0024.** See [QA_OWNER_OBSERVED_STATE_20261024.md](QA_OWNER_OBSERVED_STATE_20261024.md) for observed evidence and limits. The database UUID, exact served source/build, full hosted schema and freshness/custody are **not** established by screenshots; an isolated QA code deployment is **not** authorized or claimed. All instructions below referring to 23 migrations are **historical**, not a present-day instruction to migrate.

This checkpoint is for **First In Response Exteriors Business App**, not the public website or the Business Command Center.

## User-visible source fixes that need device acceptance

- **Job Report:** six-item checklist progress, readable iPhone fields, draft versus completed save, offline/read-only behavior.
- **Job Costs:** touch-friendly category/amount/description, confirmed cost totals, errors and double-tap protection.
- **Customer View:** safe owner return navigation, correct agreement and price, customer-only links.
- **View Invoice:** paid principal, invoice total and balance, narrow iPhone layout, owner return navigation.

These are source/build/browser achievements, not installed-phone or hosted QA proof. The official accepted production release gates remain **3/10 (30%)**.

## Why the existing QA Worker has not been updated

The original QA database uses the first published **23** migrations. The current candidate has **25** because it adds an owner deposit audit and signed-agreement snapshot. The existing read-only QA reviewer correctly refuses a code-only publication when SQL differs. Do not weaken or bypass that protection, and do not run the original first-publish script on the existing Worker. A successful disposable SQLite migration rehearsal is not permission to touch hosted D1.

## Read-only owner handoff, not an authorization request

On the original Windows owner account, from the repository root, the no-network, no-write decision is:

    python .\business-app-parity\qa_iphone_release_readiness.py

If the owner wants to collect the existing **hosted QA schema metadata only**, use the already tested, exact-identity capture:

    python .\business-app-parity\capture_existing_qa_schema_read_only.py --capture

The capture asks for a separate, exact typed confirmation and uses ten reviewed SELECT-only queries against the pinned isolated QA database. The private capture remains in the owner's original backup folder. No customer, payment, credential or photo rows should be collected.

After a successful private capture, verify it without contacting Cloudflare:

    python .\business-app-parity\qa_iphone_release_readiness.py --capture-file "C:\PATH\TO\PRIVATE\FIRE-EXISTING-QA-SCHEMA-ONLY.json"

A matching recent capture still reports STOP: independent Cloudflare source provenance, recoverable QA backup/restore, exact schema migration authorization, code-update authorization and physical iPhone acceptance are missing. Do not paste secrets, full private backups or login files into chat.

## Acceptance path

1. Verify hosted QA metadata identity and historical 23 migrations read-only.
2. Independently review two pinned additive migrations, backup/recovery, current Worker identity and rollback plan, with distinct exact owner approvals **before** any hosted write.
3. Publish only a separately approved isolated synthetic QA candidate after all remote preflights pass.
4. In normal chat, independently compare the four user-visible screens and test the published QA version on the physical iPhone. Use fictional records; never process real payments.
5. Keep LIVE, protected staging, Doomsday, Stripe and all existing customer records untouched.

**Normal chat handoff is not yet ready.** This document is a review checklist, not evidence that steps 1–4 have happened.
