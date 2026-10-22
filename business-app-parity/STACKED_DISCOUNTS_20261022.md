# Stacked estimate discounts — isolated source candidate

The existing 30 standard service rates, per-job rate/flat/reset controls and saved line totals remain in place. A draft estimate can now combine its existing percentage (or dollar) discount with a separate exact-cent bundle amount. $460 less 15% ($69) and $25 is $366 with a $183 standard deposit. Appreciation, percentage caps, the existing $150 minimum and 50% deposit rounding are unchanged. Requested components are shown separately from the actual discount when the minimum limits the reduction.

Promotions remain deliberately owner-applied. The October 15% promotion is for qualifying bookings placed on the schedule by October 31, 2026, including later service dates. The editor explains this eligibility; it does not guess booking qualification or automatically apply a promotion.

## Persistence and protection

No new migration or backfill. New stacked estimates write a versioned, estimate-bound snapshot in the existing backed-up `message_templates` storage namespace `fire:estimate-discounts:v1:<id>`. The snapshot and estimate/items are written in one database batch. Existing customer message-template keys and standard-rate keys remain separate. Aggregate estimate totals stay authoritative; reads never recompute or replace historical totals from current settings.

The owner-only uncached breakdown read verifies every saved component and the agreed monetary aggregates. Missing, corrupt or mismatched stacked metadata stops repricing rather than assuming a zero bundle. Legacy drafts remain editable when their original stored terms match their agreed totals. A client omitting the bundle field cannot silently reprice a snapshot-bearing quote. Signed, accepted, approved, scheduled, completed, paid and invoiced estimates remain protected from estimate repricing.

The editor waits for the verified breakdown, offers an explicit read retry, keeps drafts on failed save receipts and validates stacked monetary receipts. Duplicate taps use the existing save lock. Customer estimates display the frozen promotion and bundle amounts, with a review hold for inconsistent snapshots. No customer messages are sent by these changes.

An older Worker does not understand this namespace. After a future authorized publication, do not edit stacked drafts through an older build during a rollback. Preserve both the stored agreed totals and snapshot and use the reviewed recovery procedure/current build before repricing. This source change does not authorize any rollback, hosted database write or publication.

## Verification scope

`test-stacked-estimate-discounts.mjs` exercises actual API routes against disposable SQLite, input failures, minimum/appreciation arithmetic, saved breakdowns, legacy clients, historical holds, authentication and atomic rollback. `test-stacked-estimate-discounts-browser.mjs` exercises the actual React editor in Chrome at 320/390/768 pixels in light/dark modes, duplicate taps, save/reopen and failed reads/write replies. `test-stacked-discounts-workflow.mjs` extends the existing disposable built-QA Worker/native D1 browser workflow through the public estimate and reopened editor. CI retains synthetic mobile screenshots.

Local/CI candidate results are not deployed proof or physical iPhone acceptance. Production release gates remain **3/10 (30%)**. Existing QA evidence and separate migration/Worker approvals remain required. Do not repeat the owner's successful backup export, restore or 23-to-25 rehearsal merely because source advanced; review exact source/build identity and existing retention/provenance requirements for the future approval packet.
