# Deposit versus invoice due — October 9, 2026

Aligned owner due-now displays with existing collection policy. Approved/scheduled jobs use the reservation deposit less paid principal even when an existing/restored invoice is present. Completed jobs still use the revised invoice total. Shared dashboard loader matches the helper. Invoice GET now includes estimateStatus/depositCents; Invoices action passes those fields instead of implicitly treating every job as completed. Full remaining balance and payment API/atomic collection guards unchanged.

Normal invoice creation requires completion; billed jobs cannot move backward. Actual endpoints verify both. The mismatch can nevertheless occur in existing/restored pre-completion invoice records; it is not claimed reachable through normal invoice creation. Restores already preserve such records in prior synthetic tests. No records rewritten.

390/390 new assertions (130 per target), 12/12 selected suite runs; TypeScript 3/3, completed builds 3/3, shared source 119/119. Tests execute actual routes/SQL and invoice action plus UI helper with synthetic SQLite. Three negative controls reject prior helper, dashboard SQL and invoice API. Existing dashboard regression expectation updated for approved invoice deposit policy; completed revised invoice coverage preserved. Evidence stores snapshots, paths and hashes; historical release manifest remains stale.

Overall verified readiness: 30% (3/10 release gates). Formal deployed/mobile parity 0/32; complete remote schema/journals 0/3. No deployment, remote writes, Stripe mutations or paid resources. Candidate rendering and iPhone review remain unverified.

Next bounded task: read-only deployed Payments screen comparison on known staging and Doomsday targets, including history/status and navigation. Capture only synthetic staging records; keep real customer/financial data out of repository evidence. Actual deployment identities and mobile viewport remain separate acceptance gates. Regular chat can independently review this candidate diff/evidence read-only.
