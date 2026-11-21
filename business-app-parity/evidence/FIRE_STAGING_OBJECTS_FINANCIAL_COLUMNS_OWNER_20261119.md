# Nov 19, 2026 — authenticated STAGING D1 full object inventory and financial column/coverage proofs (owner originals)

**Physical target:** `fire-app-staging-db`, Cloudflare D1 physical UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad` — consistent database breadcrumb and URL fragment visible in all ten owner-supplied screenshots. Same already authenticated Console used in the [complete 22/22 original journal](FIRE_STAGING_COMPLETE_PHYSICAL_JOURNAL_OWNER_20261119.md), which MUST NOT be re-requested.

**Evidence custody:** The owner provided ten original photographs in the private conversation. Original photograph binary bytes stay private; no raw screenshots, customer names, contacts, tokens, payment values or other owner data have been uploaded to this GitHub repo. Exact SHA-256 of the received original files, checked locally without OCR:

| Original image filename | Physical query/screen section | SHA-256 |
|---|---|---|
| `IMG_F02A4757-3FBC-4CC3-8397-5AC1886FFEE8.jpeg` | Step 1 (index objects start) | `be35b66494039538504a53f8b9ac5f4c883e043b13b240a95d635b448dd1f221` |
| `IMG_587703D7-3D2A-4A20-990E-17037F3B2787.jpeg` | Step 1 (index objects middle) | `86a8da841125d4a29ab127fe0ed9244c4f2c2abce2c6abb1baf01eb72d93553b` |
| `IMG_E87FDB30-CBC8-4338-AD44-509BF9180E61.jpeg` | Step 1 (indexes end + tables start) | `4915d7187f15f2a8873613f201c714129763241ea6e9a7f87d482486fd182443` |
| `IMG_CC00B659-1E9B-431E-BCC6-7751A558F331.jpeg` | Step 1 (tables end) | `330e6949e2aeac5aab8c175c141d6d5f5044bc27860c2b7d0f876b5752f6c1b7` |
| `IMG_C2505F29-A183-46BE-B081-6A3BFC65DFEB.jpeg` | Step 2 (12 expected object statuses) | `f2ae9e7f7a93b30c9423dcc241d39db6d5561e22dff328132a88cdea2be289a4` |
| `IMG_9FB34386-3147-4A10-9D4F-BD8A6AB46F8C.jpeg` | Step 3 (estimates columns 0–10) | `a567e6eb4d26f17ff1cdd17b41416e0e12cece9b297949ac41b7fc5b449130c8` |
| `IMG_5EE0C194-5544-4885-9E8D-6BD5562C11D5.jpeg` | Step 3 (estimates 11–19, invoices 0–4) | `34babf041c4dc3d95da87dd5673dbd5e533e75cb710240e9c34691f0a68ba63c` |
| `IMG_2D6628BE-F019-4F60-9EA7-B0695B757932.jpeg` | Step 3 (invoices 5–12, refunds 0–5) | `cdf5f8ac36e0f88d8cdd5b2ebc4dc0008906e447dd58e4bd7b9d25f2c7cd29f8` |
| `IMG_000EF925-FE55-437D-BC41-27F5AAE29B82.jpeg` | Step 3 (refunds 6–9, payments 0–9) | `5849d07f86c647298e9b131930ae4d49a22c9d036f03fc63dc8b570854e91a27` |
| `IMG_6E933D86-EB04-4632-B395-D3659B820BED.jpeg` | Step 3 (payments through 10) | `a4525cb72083b5231183794b5b80233b4ee1f075a30a05cd4a0f4a22eca1eb4e` |

## #1 — Actual `sqlite_master` named object inventory: physically captured

Read-only browser Console query: `SELECT type,name,tbl_name FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND substr(name,1,7)<>'sqlite_' ORDER BY type,tbl_name,name;`. Original photos 1–4 follow consecutive result rows from indexes beginning with `idx_customer_messages_customer_id` and ending with `idx_tasks_status_due`, then application/provider tables from `_cf_KV` through `tasks`.

**Visible table names:** `_cf_KV`, `auth_rate_limits`, `customer_messages`, `customer_notes`, `customer_photos`, `customers`, `d1_migrations`, `estimate_change_requests`, `estimate_items`, `estimates`, `expenses`, `invoice_items`, `invoice_revisions`, `invoices`, `job_reports`, `message_templates`, `notifications`, `payment_checkout_sessions`, `payment_refunds`, `payments`, `tasks`.

**Key verified indexes (physical, names visible):** `idx_invoices_one_per_estimate`, `idx_notifications_unique_lifecycle`, `idx_payment_refunds_estimate_status`, `idx_payment_refunds_payment_status`, `idx_payment_refunds_provider`, `idx_payments_unique_refund_provider`, `idx_payment_checkout_sessions_one_open_per_estimate`, `idx_estimates_customer_id`, `idx_customer_photos_customer_id`, `idx_invoices_customer_id`, and further customer/estimate/message/invoice/task indexes in screenshots. `_cf_KV` is a provider table, **not a new FIRE feature**. No deposit audit trigger names are shown; confirmed absent by targeted query below. Inventory confirms object presence by name, *not* identical DDL, index uniqueness/WHERE clauses, user ownership or records and financial runtime behavior.

## #2 — Exact expected financial object existence readback, 12/12 statuses visibly captured

Owner read-only `WITH expected(name) AS (VALUES ...) SELECT e.name,COALESCE(m.type,'MISSING')...` query output 12 names (one photo). The visibly PRESENT five:

- `idx_invoices_one_per_estimate` — present (table/index as appropriate)
- `idx_notifications_unique_lifecycle` — present (table/index as appropriate)
- `idx_payment_refunds_provider` — present (table/index as appropriate)
- `idx_payments_unique_refund_provider` — present (table/index as appropriate)
- `payment_refunds` — present (table/index as appropriate)

The visibly MISSING seven:

- `deposit_agreement_snapshots` — MISSING
- `deposit_agreement_snapshots_no_delete` — MISSING
- `deposit_agreement_snapshots_no_update` — MISSING
- `deposit_policy_events` — MISSING
- `deposit_policy_events_no_delete` — MISSING
- `deposit_policy_events_no_update` — MISSING
- `idx_payments_stripe_provider_unique` — MISSING

This agrees with the previously verified STAGING **22 installed migrations**. In source, `0022_stripe_provider_uniqueness.sql` adds the later Stripe provider unique index, `0023_deposit_policy_events.sql` adds audit table/two immutable triggers, and `0024_deposit_agreement_snapshots.sql` adds signed snapshot table/two immutable triggers. **This is a documented hosted STAGING schema PARITY GAP**, not an invitation to apply migrations. No physical STAGING 25/25 claim; QA's separately accepted 25 and independent DR/NEW LIVE 26 should not be repeated.

## #3 — Four actual financial table column inventories, screenshots 6–10

Owner issued read-only `JOIN pragma_table_info(m.name)` against `estimates`, `invoices`, `payment_refunds`, `payments`. Original photos show all four table sections with contiguous `cid` values:

- `estimates`: columns `cid 0–19`, including `customer_id`, `status` default `draft`, `subtotal_cents`, `discount_cents`, `total_cents`, `deposit_cents`, `scheduled_at`, `share_token`, `signed_name`, `signed_at`, `contract_version`, `photo_release`, `appreciation_discount`, `additional_discount_type` (default `percent`) and `additional_discount_value`.
- `invoices`: `cid 0–12`, including `estimate_id`, `customer_id`, `status` default `draft`, `total_cents`, `share_token`, `subtotal_cents`, `discount_cents`, `discount_type` default `dollar`, `discount_value`.
- `payment_refunds`: `cid 0–9` (ten columns) including `payment_id`, `estimate_id`, `amount_cents INTEGER NOT NULL`, `mode`, `status TEXT NOT NULL DEFAULT 'pending'`, `provider_refund_id`, `note`, `created_at`, `completed_at`. Matches 0018 source declarations by name/type/default at screenshot granularity; does not prove exact trigger/foreign-key SQL without separate evidence.
- `payments`: `cid 0–10` (eleven columns), including `estimate_id`, `type`, `amount_cents INTEGER NOT NULL`, `status TEXT NOT NULL DEFAULT 'pending'`, `provider_id`, `gross_received_cents INTEGER`, `bundled_tip_cents INTEGER`, `processing_fee_cents INTEGER`, `processing_method TEXT`. The last four are source migration 0021, now **actually observed present** on physical STAGING.

All screenshots show schema metadata only; there is **no customer/transaction amount result** and no SQL provider mutation. `G5-02` specific STAGING subproof grows but **overall remains OPEN** because other target contracts, exact index SQL, audited hosted finance and target-parity requirements are not demonstrated. `G5-05/G5-06` runtime financial accuracy/relationship checks are not satisfied by column names. Other open Gate4/6/7/9/10 requirements unchanged.

## Explicit no-repeat / next owner steps

**Steps 1–3 are COMPLETE** as physical screenshots; never ask to rerun full inventory, 12-object presence or four financial column inventories without a future actual schema change. Physical STAGING journal already COMPLETE. Owner still intends to capture **Step 4 `PRAGMA foreign_key_check;`**, **Step 5 counts-only SELECT across core tables**, **Step 6 read-only D1 Time Travel information** during same existing session. These have **NOT** been received at time of this record.

**Formal accepted release status unchanged: 50/95, 45 OPEN, 4/10 gates G1/G2/G3/G8.** No migration, host deploy, Stripe/webhook, Access/routes, money movement, data write, paid Cloudflare/R2 or Git merge. Work-branch draft PR #282 remains unmerged/undeployed.
