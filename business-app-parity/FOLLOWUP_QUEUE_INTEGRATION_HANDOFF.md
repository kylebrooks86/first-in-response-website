# Follow-up queue integration

Parent checkpoint: d3ff9d9f9ce4bc54d15874c5393cde1835161342. Branch: work/fire-business-app-parity-2026-10-08. Date: 2026-10-14 UTC (October 13 evening in America/Chicago).

The consolidated handoff archive was read and its three synthetic test scripts passed. Source archive SHA-256: b80a940e37328115e404600686bde9e88d966d3357e836611ca60b60a45c8147. It supplied standalone Sent-estimate SQL and an exact-anchor refresh transform, not an integrated endpoint. The transform was not applied over newer verified source. Its chronology fixture permits a reminder after a future-dated stage; integration deliberately requires manual review instead.

The candidates now have authenticated GET /api/followups with a validated 1..50 page limit, encoded/validated cursor, bound SQL parameters, and deterministic created_at/id descending keyset order. At most 50 records plus one continuation sentinel are fetched. It retains all estimate statuses and existing billing/customer display fields so invoice, overpayment, appointment, review and repeat-service reminders are not dropped. No unbounded estimate-item inventory is fetched.

Follow-ups exposes Load older records and retry. Appended pages keep existing record objects and deduplicate identities. Failed pages preserve loaded records. The screen clearly says whether older records remain; an empty first page of recommendations does not claim the entire history is caught up. Action priority sorting applies to loaded records, not an unseen global priority queue. Concurrent new records before the cursor require refresh; this is keyset pagination, not snapshot isolation.

Quote reminders use owner-confirmed estimate send and follow-up stages. They enforce a 24-hour contact cooldown, do not repeat a completed 1/3/7-day stage, and stop after stage 7 in the current send cycle. A deliberate later estimate resend starts a new cycle while original history is retained. Legacy sends without a confirmed initial send and malformed/future/out-of-order chronology show Review estimate instead of an automatic reminder suggestion. Records are not repaired or backfilled automatically. Prepared/copied events never qualify as confirmed contact.

After successful owner confirmation, local reminder markers update immediately and the screen refreshes from the bounded endpoint. Preparation alone does not refresh or imply sending. Failure retains truthful state; no automatic sending or retry occurs. A cached minute-tick clock bug found during testing was corrected in Follow-ups so a newly confirmed message is not falsely future-dated. A test cleanup race was fixed by waiting for refresh completion.

Final validation: 105/105 actual framework browser checks, 87/87 timing/stage cases, 207/207 synthetic financial regressions, 3/3 TypeScript checks and 3/3 builds. Native disposable D1 tests traversed 126 records over three pages, including 125 tied created_at values, with no omissions/duplicates. They verified page limits, invalid cursor rejection, unauthenticated rejection, failed-page retention and explicit retry. All 133 shared source files match. See FOLLOWUP_QUEUE_INTEGRATION_EVIDENCE.json for hashes and per-target scope. Source parity is not verified deployed parity.

No production deployment, migration, Stripe action, paid service, app/device reset or storage clearing. Original apps, calculator, production records, iPhone Revision 3, iPad Revision 1 and encrypted backups remain untouched. No CSS change; shaking remains tracked.

Remaining: estimate-history pagination has not yet been integrated; reuse the bounded query pattern without changing existing financial callers. Multiple-property support remains dependent on immutable historical service-address snapshots; see CUSTOMER_PROPERTY_RELATIONSHIP_AUDIT.md. No property table, migration or property UI was added. Next bounded task is estimate-history pagination. Native Messages/Mail return, confirmation resumption after reload and coordinated publication compatibility remain unverified.

Official release readiness remains 30% (3/10 gates). This candidate integration does not complete a release gate.
