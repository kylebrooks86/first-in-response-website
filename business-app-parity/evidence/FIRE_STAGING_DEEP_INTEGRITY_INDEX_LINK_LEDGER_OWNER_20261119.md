# Nov 19, 2026 — physical Cloudflare STAGING deep SQLite integrity / financial uniqueness / relationships / ledger state

**Target:** owner-authenticated `fire-app-staging-db` Cloudflare D1 Console, previously independently bound physical UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`, with applied 22-row Doomsday-family migration lineage.

**Evidence provenance:** Ten original owner screenshots from the Nov 19 interactive Cloudflare console, uploaded in the private conversation, are locally mounted and original bytes SHA-256 independently computed. The owner's subsequent *seven additional* Step 13 continuation images were also supplied in conversation, but source bytes were not available for independent local hashing in this evidence-writing session. **DO NOT claim these later seven file hashes or infer unseen column rows.** Private screenshots remain with the owner/conversation and are NOT published to GitHub. GitHub stores only non-PII metadata.

| Original screenshot name | Coverage | Measured original SHA-256 |
|---|---|---|
| `IMG_EADD5FD7-6DBA-4953-94E4-394DD494BE49.jpeg` | Step 7, PRAGMA quick_check | `1680aec5eb584ac0c2848e39aad7b0359cef87c0941c628dc8c2ef418aacba47` |
| `IMG_AE0AD010-3955-4DAA-BCDF-3057A4AF1522.jpeg` | Step 8, exact five unique index definitions | `977fc9bce89a654fb30c08594ed425c1e4b5ea0aafcca0a0350a4d6def22ea0a` |
| `IMG_8564FFD7-2387-4928-A3E0-FC85ECD19102.jpeg` | Step 9, actual 7 declared foreign keys | `639443eaff3a069de20c0cdb631299089a755f52efe82937bf8588397dcf157a` |
| `IMG_F3A0A65D-FDEC-4486-9390-FD2C4866D0C7.jpeg` | Step 10, relationships and photo/notes/messages counts, left side | `3ba095e461de0079920ceb2172668c852c4e50123d903aaea882b9248adf61af` |
| `IMG_77A0121C-7090-4616-8AE8-128CEFBF8461.jpeg` | Step 10, same results horizontally scrolled right | `891e24d5e9eb21d07a673e1e41317194edca004db161fe3dec310a6aaac7306b` |
| `IMG_DE9CCE81-9A66-4719-8577-612A093F1A6A.jpeg` | Step 11, zero four amount flags and standard-half estimate count 1 | `fd86293fa589f11e0b0050b775cc9073cc6e5500d7e85916cb516d090eee1831` |
| `IMG_98264190-2336-469A-82C7-2BAE47B52869.jpeg` | Step 12, grouped payment/refund/invoice/estimate statuses | `51f579222377e05a9dc361654d37dd55eff098ad1c0a3bc34d793bf4a16691bd` |
| `IMG_82F195B8-3AFD-41F6-8256-9FE6C3B203F1.jpeg` | Step 13 nonfinancial columns, first rows auth_rate_limits/customer_messages | `62d44b354fcd51d0750e0e5d31678874b45678876268b30cb6a1a2fe925b3a4c` |
| `IMG_5DDE63E8-A787-4391-A53B-876D9B20D2E3.jpeg` | Step 13 nonfinancial columns, customer_messages/notes/photos rows | `235f792f94804914b649599682c4c8433eb08d3daf09f78bd778a63e972979bb` |
| `IMG_4E311569-A328-45A0-B323-F9ED11980FA3.jpeg` | Step 13 nonfinancial columns, customer_photos/customers/estimate_change_requests rows | `271a35967528fd04ee598b5743b459f017033176e3b827d74e388bb8aeaca68e` |

## Step 7 — actual `PRAGMA quick_check;`: PASS

Original Cloudflare read-only console shows a result field `quick_check` = **`ok`**. This is physical SQLite structural quick-check success for STAGING. It is not `integrity_check` full scan, a restore/backup proof, an immutable photo-file hash, or an owner-authorized hosted recovery.

## Step 8 — five physical unique index definitions: verified

The owner ran `SELECT name, REPLACE(...sql...) AS definition FROM sqlite_master WHERE type='index' ...`. The returned five actual SQL definitions are **`CREATE UNIQUE INDEX`**:
- `idx_invoices_one_per_estimate` — `invoices(estimate_id)` uniqueness;
- `idx_notifications_unique_lifecycle` — `notifications(type, estimate_id)` partial WHERE `estimate_id IS NOT NULL` and `type IN ('estimate_viewed','invoice_viewed','estimate_accepted')`;
- `idx_payment_checkout_sessions_one_open_per_estimate` — `payment_checkout_sessions(estimate_id)` partial WHERE `status='open'`;
- `idx_payment_refunds_provider` — `payment_refunds(provider_refund_id)` partial WHERE `provider_refund_id IS NOT NULL`;
- `idx_payments_unique_refund_provider` — `payments(provider_id)` partial WHERE `provider_id LIKE 'refund:%'`.

**These specific index definitions now have physical SQL-level proof**, beyond the previous name-presence inventory. The **separate** `idx_payments_stripe_provider_unique` from migration 0022 is *missing* physically as already established; no mistaken parity claim.

## Step 9 — declared FK relationships (actual PRAGMA)

The user ran 5 separate `pragma_foreign_key_list` functions combined into one read-only UNION: **7 actual declarations**:
1. `estimates.customer_id -> customers.id`, NO ACTION delete;
2. `invoices.customer_id -> customers.id`, NO ACTION;
3. `invoices.estimate_id -> estimates.id`, NO ACTION;
4. `payments.estimate_id -> estimates.id`, NO ACTION;
5. `payment_refunds.estimate_id -> estimates.id`, NO ACTION;
6. `payment_refunds.payment_id -> payments.id`, NO ACTION;
7. `customer_photos.customer_id -> customers.id`, NO ACTION.

This complements previously accepted `PRAGMA foreign_key_check` with no displayed violations. It is **not proof** every app feature has a declared FK, all-target parity or cross-customer HTTP session privacy.

## Step 10 — physical stored-record link guards/notes/photos counts

The read-only count query's 8 outputs show **0** for invoice-to-estimate customer mismatches, refund/payment estimate mismatches, orphan customer messages, orphan customer notes, orphan customer photos, **0 customer_photos rows, 0 customer_messages rows, 0 customer_notes rows**. This is a current, observed clean state for these particular predicates; with **no photos/messages/notes in STAGING**, their orphan checks are *vacuous*, not restored-photo sync proof. The `<>\u0060 style comparison doesn't detect NULL or all missing-parent cases; the query must not be treated as complete cross-customer audit or customer relationship integrity. No data was modified.

## Step 11 — financial schema/value sanity and standard deposit

Four specific counts returned **0**: `estimate_range_flags`, `invoice_range_flags`, `refund_amount_flags`, `payment_fee_flags`. The `standard_half_deposit_count` returned **1** matching the existing STAGING one-estimate record. This is stronger physical metadata/observed-record support for G5-05 (range and gross/tip/fee constraints) but **not the full actual booking/discount/tip/refund exact-cent matrix**, legitimate promo stacking, Stripe delivery or independent settlement reconciliation.

## Step 12 — actual normalized state groups (counts-only)

The physical query returned six rows, one record each:
- **Estimate:** `completed` ×1.
- **Invoice:** `partial` ×1.
- **Payments:** `Refund / paid` ×1, `Tip / paid` ×1, `balance / paid` ×1.
- **Refund:** `stripe / succeeded` ×1.

This demonstrates a saved Stripe-mode succeeded refund **status in STAGING's D1**, but is **not evidence of fresh authenticated Stripe provider TEST refund, signed webhook, external account mode, one-to-one receipt, or all invoice math correctness**.

## Step 13 — non-financial column readback ongoing

The owner ran the read-only generic `sqlite_master + pragma_table_info` query to enumerate nonfinancial table columns. Original ten-file evidence batch captures:
- `auth_rate_limits` primary key, attempts and time-window columns;
- `customer_messages` id/customer_id/estimate_id/channel/template/body/created_at;
- `customer_notes` id/customer_id/body/created_at;
- `customer_photos` id/customer_id/category/caption/filename/content_type/size_bytes/object_key/created_at;
- `customers` id/name/email/phone/address/created_at/lead_source;
- first portion of `estimate_change_requests`.

The owner supplied seven more consecutive photos in a subsequent message; their image files were not yet accessible through this session's local file inventory. **Treat their raw bytes and unverified exact last-row coverage as pending, not absent. Do NOT re-request previous ten images or redo Step 13 from scratch.**

## Acceptance/no-repeat rule

**Steps 7–12 are physically captured and credited now, never rerun absent changed STAGING database.** Step 13 partial first ten/batch plus newer seven continuation photos supplied; no need to resubmit already attached photos. These newly complete *STAGING-specific subproofs* within G5-02 (unique SQL & FKs), G5-05 (range and ledger state), G5-06 (link consistency), G7 (SQLite quick check), **not any new full 95-row gate item**. G4/G5/G6/G7/G9/G10 overall remain OPEN. STAGING still 22/25 source migrations; do not apply 0022–0024 without separately exact-scoped approval and staged backup/rollback checks. No Cloudflare/Stripe/API write, SQL mutation, paid R2/subscription, Access/routes, deployment, merge or cutover. **Official checklist remains 50/95 accepted; 45 open, 4/10 formal gates G1/G2/G3/G8 accepted.**
