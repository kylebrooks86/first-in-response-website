# Owner-approved financial and activity roadmap

Official release readiness remains 3/10 (30%). This is an implementation backlog, not a claim of acceptance. No hosted resource changes are authorized.

## Next: truthful balances
Separate draft/sent potential estimate revenue from accepted/scheduled/completed collectible principal; show required deposit remaining separately. Reuse revised invoice totals and paid principal excluding tips and refunded principal correctly. Preserve all stored totals and payment history. Verify the owner's two-$200/no-payments example with synthetic records.

## Required deposit and explicit owner exceptions
Default every new job to 50% of final discounted estimate. Require recorded net principal to meet the deposit before normal scheduling; never create payment on approval. Preserve existing scheduled jobs and signed agreements. Support explicit authenticated owner confirmation to waive, reduce by dollars/percent, allow scheduling before collection, or restore standard terms; capture original/adjusted requirement, timestamp, owner and optional reason in durable audit history. Remaining job balance is always full approved/invoiced principal less actual payments/refunds, never reduced by deposit exceptions. Paid deposits reduce any remaining upfront requirement; never recharge paid amounts.

This needs coordinated shared schema, record backup/restore coverage, atomic scheduling guards, immutable signed-term snapshots, customer disclosure/document versioning and checkout-session invalidation/reconciliation tests. Source/local migrations and synthetic tests may be prepared; do not run hosted migrations or change existing signed data. Gate customer-facing release until these contracts pass.

## Unified timeline and in-app notification preferences
Record customer changes, estimate lifecycle, signatures/photo permission, appointments, deposit exceptions, payments/refunds/invoice updates, communications and job statuses with source IDs, timestamps and actor. Preserve historical records without fabricating missing events or deleting audit rows. Derive old events honestly; persist new events atomically and deduplicate by stable source/action ID. Notifications remain independent of full activity history. Add category preferences and optional every-customer-change switch while preserving bell/unread counts/history; distinguish owner/customer actors. No paid push services.

## Completed prerequisites
Owner preview Close: 34dca12751016b2d38e322a86b6412a99685b787. Shared explicit customer lookup: 799e1986a52dbdb439089a3caca79e8a92f00d41. Photo layout and Messages compose are in the current verified UI batch. Preserve both actual QA $200 estimates, signatures and appointment. Newly recorded owner iPhone evidence remains partial Gate 8 evidence; persistence follow-up is pending.
