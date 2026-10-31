# FIRE Customer # and completed-job history — source-only candidate

**Owner-approved experience:** Every real customer has one durable Customer # (e.g., Customer #0042), separate from FIRE Job #. It appears beneath the name in the customer directory/profile and on owner/customer estimate and invoice records. A compact **Completed jobs (N)** expandable area shows distinct finished jobs with their actual existing Job # (when independently enabled), dates and saved totals. New estimates, drafts, scheduled but unfinished work and invoices alone are **not** completed jobs. If the same customer returns years later, they retain their Customer # and the new work receives a separate Job #.

## What the source branch does

- Defines a separate immutable `fire_customer_numbers` table with SQLite AUTOINCREMENT, a unique customer UUID mapping, strict customer FK, and triggers blocking update/delete. **This SQL lives in `business-app-parity/customer-numbering/` outside all active migrations**. There are zero hosted schema changes at this stage.
- Existing customer UUIDs, estimate/share token IDs, invoice IDs, signatures, ledger data and photo references are unchanged.
- New customer creation **only when** `FIRE_CUSTOMER_NUMBERS_CANDIDATE=owner-approved-schema-v1` and the private schema/backfill is complete: performs the existing duplicate-protected customer INSERT and number allocation in the **same D1 atomic batch**. A duplicate or retry does not allocate another number. A missing/partial map fails closed instead of inventing a label.
- Owner customer directory/details, owner estimate/invoice history, customer lookup/confirmation, and validated customer share-token estimate/invoice pages render the database-backed number; feature-off/unmigrated apps retain their original presentation.
- Completed jobs count from a customer's **completed** estimate status; when Job # is independently enabled, multiple estimate revisions sharing one Job # count only once. In older unmigrated state, distinct saved estimate IDs are used without fabricating a Job #. The existing detailed progress history remains separately available collapsed.
- All money and customer workflows remain unchanged. No migration, deployment, payment, Stripe, email or SMS occurs through these source changes.

## Release prerequisite — NEVER automatically run this SQL

1. Identify exact authenticated LIVE/QA/staging/Doomsday Worker and bound D1 UUID, current migration journals, and verified private rollback/archive per environment. LIVE's prior `payment_refunds` discrepancy remains an independent Gate 5 blocker.
2. Obtain a private, metadata-only historical customer preflight from a **verified** protected database backup. Preserve existing customer creation timestamps and IDs. Resolve ambiguous duplicate identities, imports or deletes before proposing a Customer # assignment.
3. In an **isolated offline/private rehearsal** (never here), sort all original rows by `created_at ASC, id ASC`, apply the immutable table/triggers then assign once with `INSERT INTO fire_customer_numbers(customer_id,created_at) SELECT id,created_at FROM customers ORDER BY created_at,id`. Verify coverage, uniqueness, foreign keys, triggers and reconciliation of customer counts before any environment write.
4. Protect original backup and migration chain, obtain separate owner approval for the target-specific additive migration/backfill, and run only on separately approved QA/staging first. Do not treat the prototype `.sql` as an already applied migration.
5. Confirm 100% mapped original customers, no orphan links, allocation under concurrency, and same customer number on owner/customer-facing estimates and invoices, while the previously accepted Job # remains separate. Only then enable the feature flag for that specific Worker. Test a customer edit/reopen, two jobs years apart, invoice creation, and a repeat save.
6. No production deployment, schema write, cutover, Stripe action, merge or release Gate 4–10 acceptance is authorized by this design alone.

**Current hosted QA remains on source `78df2a10d8e6165a3b4d572856fbf243824e7086` (version `99fa8c27-df83-48d3-b953-9a84eb295334`) and does not have Customer # enabled.** This branch must not silently displace its accepted QA test results. Formal FIRE production acceptance is still 3/10 gates.
