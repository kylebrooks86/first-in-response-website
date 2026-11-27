# November 18, 2026 — Real hosted QA D1 refund foreign-key definitions verified

## Original physical source and custody

The FIRE owner supplied a new original photograph of an authenticated existing Cloudflare D1 Console session in chat, showing D1 breadcrumb `fire-fullapp-qa-db-20261016` and URL D1 UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`. The owner executed the read-only query:

```sql
PRAGMA foreign_key_list(payment_refunds);
```

Original private image: `IMG_1FB496BC-9559-4CE2-8906-0CDBCFA892AF.jpeg`, **309,615 bytes**, SHA-256 **`6297dcaf25cce0faed085aefa7f43e5cc982a04e065088d592921e9c75ba629f`**. The original pixels remain in the owner conversation; do not publish them to the public GitHub repository.

## Directly observed D1 response

The provider returned exactly **two defined foreign-key mappings** on `payment_refunds`:

| id | seq | table | from | to | on_update | on_delete | match |
|---:|---:|---|---|---|---|---|---|
| 0 | 0 | estimates | estimate_id | id | NO ACTION | NO ACTION | NONE |
| 1 | 0 | payments | payment_id | id | NO ACTION | NO ACTION | NONE |

Visible response time 542 ms, query time 0.28 ms. The two physical column-level relationships and actions match the reviewed source migration at `business-app-parity/adapters/doomsday/drizzle/0018_payment_refunds.sql` (blob SHA `7c117a31e82849a40676b860f564d6bd9f94d57b`).

## Precise acceptance and no-repeat boundary

✅ **G5-02 QA physical `payment_refunds` FK-definition subproof COMPLETE** (two expected reference relationships, both with NO ACTION). This complements, without repeating:
- [QA ten-column PRAGMA](FIRE_QA_REFUND_COLUMN_PRAGMA_OWNER_20261118.md).
- QA physical 25/25 ordered migrations, actual refund/payment index-DDL and provider uniqueness.
- QA physical `pragma_foreign_key_check` count of zero currently violating rows.
- Historical STAGING 22/22 migration journal, refund-table/index objects, known zero user triggers.
- Previously accepted independent DR and NEW LIVE 26/26 migrations.

This query **does not prove** `PRAGMA foreign_keys=ON` on the Worker runtime DB connections, that future runtime inserts enforce these relationships, settlement/refund status correctness, nonempty linked rows, hosted event processing, or four-target schema parity. Treat as real new QA physical schema proof only; do not make up an accepted whole release item. **Do not re-request this `PRAGMA foreign_key_list(payment_refunds)` or any earlier QA refund PRAGMA, index, migrations or integrity screenshot.**

**Current formal acceptance unchanged:** 45/95 whole checklist items completed, 50 open; 4/10 accepted release gates G1/G2/G3/G8. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK/NO-GO; real Job #0001 unissued. Existing QA source is the appearance/functionality master. Existing QA/STAGING/DR/NEW LIVE physical migration counts are 25/22/26/26 respectively; do not attempt any unauthorized cross-environment schema write. This record is documentation-only on draft PR270, with no deployment, provider mutation, R2, Stripe, login/token, SQL write, merge or public release.
