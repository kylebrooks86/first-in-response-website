# November 19, 2026 — owner authenticated Cloudflare STAGING D1 physical FK integrity, record totals and Time Travel

Target: `fire-app-staging-db`, previously bound physical D1 UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`. These are the owner's **four additional original photographs in the same already-authenticated Cloudflare console session**, following [full 22-migration journal evidence](FIRE_STAGING_COMPLETE_PHYSICAL_JOURNAL_OWNER_20261119.md) and [10-image schema/financial inventories](FIRE_STAGING_OBJECTS_FINANCIAL_COLUMNS_OWNER_20261119.md). The original screenshot bytes remain **private**; do not publish raw photos or any customer/payment information in GitHub.

| Original photograph | What it shows | Original byte SHA-256 |
| --- | --- | --- |
| `IMG_C59FFF73-281D-4E21-8591-5DDD0E251A3A.jpeg` | PRAGMA foreign_key_check executed with no returned violation rows | `0d9da68f8c1dce80cb8c99834e3aac42e448b3a6be6aab55c5d657710909376e` |
| `IMG_E802BA9E-307A-4FA7-95DD-C39F978230C1.jpeg` | Seven stored-record counts in one read-only output | `3ed2a9cc7f539112aeedb7de5eda690e7f8a29db3f5d7b1890ec7cab40250074` |
| `IMG_9A0E1358-AB2C-4C01-97BA-07DAD7EE07DF.jpeg` | Time Travel top: seven-day restore window visible | `4bb92635f1a52fdca62f31c532d083bd734c03a4511cdad78bcce0df2a61ccca` |
| `IMG_F2FA5FC3-22F2-4D58-8BC0-D5AE80030E91.jpeg` | Time Travel bottom: bookmark retrieval and restore warning visible | `0b2c38c88baad8f30003df8dcd3e72c143e7fa02140515edeec0093df5d21942` |

## Step 4 — read-only SQLite FK violations check

The owner executed `PRAGMA foreign_key_check;`. The authenticated Console states **"This query successfully executed."** and shows no returned violation rows, response time 480ms, query 1.07ms. **Outcome:** No FK violations displayed in this physical readback. This does **not** prove every desired application relation has an actual physical FK declaration (SQLite checks declared constraints), and does not establish hosted API access controls, cross-customer denial or immutable ledger semantics.

## Step 5 — redacted counts-only actual STAGING saved records

One read-only SELECT returned an exact seven-field count row:

| customers | estimates | invoices | payments | refunds | notifications | tasks |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 3 | 1 | 6 | 0 |

These exactly agree with the already accepted Nov1 STAGING isolated SQL archive's core historic count (customers 1, estimates 1, invoices 1, payments 3, refund 1, journal 22) while adding current notifications 6 and tasks 0. **Do not repeat original export/restore for these counts.** This is actual current physical STAGING data-presence evidence, not proof new app runtime/parity or a point-in-time complete records/photos backup.

## Step 6 — read-only D1 Time Travel user interface

Owner visited existing physical STAGING D1 **Time Travel** tab. Dashboard visibly says restore is available **within the past 7 days**; displayed window **12 November 2026 20:33 to 19 November 2026 20:33** (as shown in UI). Current Bookmark ID button and Date/Bookmark selectors visible. UI warns **restoring an older version will overwrite current database**, and exposes a `Restore database` action. **Neither restore nor bookmark fetch was invoked**. This is physical recovery-capability availability/read-only evidence, NOT a backup, immutable off-device custody, saved original photo pair, proven restore, code rollback, recovery authorization, future coverage guarantee or Gate 7 closure. No paid Cloudflare/R2 commitment.

## No-repeat and release bounds

**Steps 1–6 of this user's STAGING console evidence checklist are ALL NOW RECEIVED**, each already executed or navigated. Never ask owner to repeat migration journal, index/table inventory, finance object matrix, four financial columns, foreign key check, seven counts or Time Travel tab screenshots except after an actual target change. Only genuine fresh targeted read-only **nonduplicate** evidence remains suitable for additional same-session collection.

Supports G5-01 (STAGING physical schema coverage), G5-02 (foreign key consistency subproof), G5-06 (physical current counts) and G7 recovery availability subproof. **No new full release checkbox accepted:** formal **50/95, 45 open**, Gates **4/10** G1/G2/G3/G8 accepted; no code deployed, no SQL write, no refund/payment/Stripe modification, no R2, no Access/routes, no merge, no restore, no owner customer contacts.
