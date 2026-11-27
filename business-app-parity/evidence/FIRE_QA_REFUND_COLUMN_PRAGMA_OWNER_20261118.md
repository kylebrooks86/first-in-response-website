# November 18, 2026 — Real QA D1 refund-table column contract, read-only owner screenshot

## Original physical evidence, custody and scope

The owner supplied a new original photograph from the **already-authenticated** Cloudflare D1 Console in the FIRE Business App conversation. Browser URL shows D1 UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`; the Console breadcrumb identifies database `fire-fullapp-qa-db-20261016`. The console displays a successfully executed **read-only** query:

```sql
PRAGMA table_info(payment_refunds);
```

Screenshot: `IMG_D8839A75-FC64-430E-9FEB-2EA2E14FA913.jpeg`; original **315,916 bytes**, SHA-256 `8f893e092b122e5ff2f1d619a9f919455445996a3a4808096cf35531802948e5`. Original image remains **private in the user conversation**. Do not upload its pixels or customer data into public GitHub.

## Actually observed physical QA D1 result

All ten returned columns and visible SQLite flags:

| cid | name | type | notnull | default | pk |
|---:|---|---|---:|---|---:|
| 0 | id | TEXT | 1 | NULL | 1 |
| 1 | payment_id | TEXT | 1 | NULL | 0 |
| 2 | estimate_id | TEXT | 1 | NULL | 0 |
| 3 | amount_cents | INTEGER | 1 | NULL | 0 |
| 4 | mode | TEXT | 1 | NULL | 0 |
| 5 | status | TEXT | 1 | 'pending' | 0 |
| 6 | provider_refund_id | TEXT | 0 | NULL | 0 |
| 7 | note | TEXT | 0 | NULL | 0 |
| 8 | created_at | TEXT | 1 | NULL | 0 |
| 9 | completed_at | TEXT | 0 | NULL | 0 |

Observed column names, type, required/not-required flags, primary-key marker and `pending` default agree with the reviewed **source** migration at `business-app-parity/adapters/doomsday/drizzle/0018_payment_refunds.sql` (source blob SHA `7c117a31e82849a40676b860f564d6bd9f94d57b`). This comparison is limited to columns/default/primary-key; this PRAGMA query does **not** attest foreign-key relationships, CHECK constraints, runtime ledger status handling, refund rows, webhook delivery, or DB-connections' FK-enforcement setting.

## New partial acceptance and explicit no-repeat boundary

✅ **G5-02 — QA physical `payment_refunds` 10-column/default/PK subproof VERIFIED** by direct owner-hosted D1 response. This complements — does **not** replace or rerun — previously accepted full QA 25/25 ordered journal, QA refund/payment index-DDL, QA declared FK integrity count zero, historical STAGING 22/22 journal + refund indexes, and independent DR/NEW LIVE 26/26 source/physical migration receipts. **Do not ask owner to re-run this exact PRAGMA.**

The **compound** G5-02 and G5-01 still remain open because old STAGING has only 22 migrations, current QA 25, and DR/NEW LIVE 26; full approved candidate four-target parity, cross-target settlement/ledger contract, and hosted runtime effects are not established. QA is the functional and visual master; incompatible target migrations must never be blindly replayed.

**Formal release status unchanged: 45/95 complete, 50 open; 4/10 gates G1/G2/G3/G8 accepted; G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK/NO-GO, real Job #0001 unused.** No SQL write, Cloudflare login/token, Access, Worker upload, subscription/R2, Stripe/payment/refund, merge, publish, migration or traffic cutover. DRAFT PR #270 remains unmerged; owner Acer exact-source build remains untouched.
