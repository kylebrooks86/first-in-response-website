# LIVE refund-table mismatch — exact read-only Gate 5 decision

**Current state: GATE 5 BLOCKED. Formal release readiness remains 3/10 (30%).**
This is a **diagnostic handoff**, not a schema migration plan or permission to deploy.

## Newly confirmed facts (October 22 Tulsa time)

Fresh authenticated read-only Sites metadata in
`HOSTED_READ_ONLY_VERIFICATION_20261022.json` records:

- **LIVE** `DB` binding and complete *table-name* inventory: **18 names**, `payment_refunds` absent.
- **Refund staging** `DB` binding and inventory: **19 names**, `payment_refunds` present.
- LIVE `GET /api/app-version` returned `105`; staging returned `refund-staging-ebc670f`. These labels alone do **not** seal a binary/source SHA or 100% deployment traffic.
- The exact candidate LIVE migration **`0019_unknown_jubilee.sql`** creates `payment_refunds` plus `idx_payment_refunds_payment_status`, `idx_payment_refunds_estimate_status`, and unique `idx_payment_refunds_provider`. The following `0020_stripe_provider_uniqueness.sql` changes Stripe provider uniqueness and requires zero collision groups. The integrated candidate has **23 LIVE migration files**.
- Sites does **not** reveal the actual physical LIVE D1 UUID, any full remote table definitions/indexes, or the applied migration journal. Therefore **it is not yet established whether 0019 was never applied, was recorded without producing the table, or another schema problem exists.** Do not assume this is just a missing migration. A mismatched recorded journal can make replay destructive or impossible.

## One focused next provider action

Request access to the **exact currently bound LIVE D1 resource** (with immutable UUID, active Worker version/build/routing reference and authenticated provider provenance). On that resource, collect the three **SELECT-only** metadata queries from
`LIVE_REFUND_GAP_READ_ONLY.sql`, in order:

1. All application table/index definitions, from `sqlite_master`; includes refund table/index names even if missing (by omission).
2. Actual `d1_migrations` ordered names, using `ORDER BY id` (not alphabetized).
3. A **single integer** count of possible Stripe provider collisions from `payments`. No individual payment/provider IDs returned.

These three SELECTs work even if the refund table is missing. The full existing 10-query release capture references `payment_refunds` and will legitimately fail on that LIVE schema. **Keep actual errors if a preflight SELECT fails. Never fabricate empty or zero results.**

Use metadata-only JSON outside Git in exactly this shape:

```json
{
  "format": "fire-live-refund-gap-triage-v1",
  "target": "live",
  "url": "https://fire-app.kylebrooks8605.chatgpt.site",
  "capturedAt": "REPLACE_WITH_FRESH_ACTUAL_UTC_TIME",
  "queries": [
    {"rows": []},
    {"rows": []},
    {"rows": []}
  ]
}
```

**The empty arrays are placeholders, NOT valid evidence.** Replace each with the full ordered provider-returned rows, retaining the original SQL row types and fields. Do not provide database data rows, full SQL export, raw response headers, Cloudflare tokens, Stripe secrets or customer information. Keep authentication and provenance receipts secure in the owner's account.

Then the **offline** diagnostic runs from reviewed repository checkout:

```sh
python3 business-app-parity/triage_live_refund_gap.py \
  --private-capture /secure/path/outside-repo/live-refund-metadata.json
```

To inspect what the already saved, limited Sites receipt establishes **now**, without a journal:

```sh
python3 business-app-parity/triage_live_refund_gap.py \
  --sites-receipt business-app-parity/HOSTED_READ_ONLY_VERIFICATION_20261022.json
```

Exit code zero means the **inspector completed**, NOT that applying a migration is safe or Gate 5 passed.

## Decision logic — intentionally no automatic repair

| Read-only comparison result | Meaning and required next action |
| --- | --- |
| `CONSISTENT_WITH_0019_NOT_YET_APPLIED` | Exact journal prefix and current structure match the local historical prefix with fewer than 20 migrations. Still needs authenticated D1 mapping, full three-target review, backup, collision/finance checks and separate owner approval before any candidate migration. |
| `REFUND_TABLE_MISSING_DESPITE_0019_JOURNAL` | The journal claims 0019 exists but the table is gone. **STOP**; do not replay 0019 until cause is independently investigated. |
| `REFUND_TABLE_PRESENT_WITHOUT_0019_JOURNAL` | An out-of-band table exists; **STOP**. Do not blindly apply 0019 or forge journal entries. |
| `UNKNOWN_OR_NONPREFIX_MIGRATION_JOURNAL` | Unexpected, incomplete or rearranged journal; **STOP** and reconcile original provider evidence. |
| `SCHEMA_JOURNAL_DISAGREE_OR_UNREVIEWED_DDL` | Actual table/index SQL differs from the exact local prefix; **STOP** and inspect DDL separately. |
| `PAYMENT_PROVIDER_COLLISIONS_BLOCK_INDEX_0020` | Indexed Stripe references are not unique; **STOP**. Never delete customer/payment history to force an index. |
| `REFUND_TABLE_PRESENT_IN_TECHNICALLY_MATCHING_LOCAL_PREFIX` | The local partial schema matches its journal, but this is **not** deployment proof, Gate 5 acceptance, or permission to release. |

Nothing in these diagnostic queries changes any hosted database. After collecting provider-authenticated identity and full metadata, independently review the original private backup/restore receipt, staging-safe migrations and the **exact** candidate artifact. Do not touch LIVE until owner separately approves a precise action and rollback plan.

The missing Sites physical resource mapping is a provider-level access blocker. The already prepared `GATE4_PROVIDER_EVIDENCE_REQUEST.md` is the appropriate provider request; repeating historical Doomsday screenshots will not supply LIVE's missing journal.

**No app, database, Stripe, customer, website, or backup write was authorized or performed by this source-only batch.**
