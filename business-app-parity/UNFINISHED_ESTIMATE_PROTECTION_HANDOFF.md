# Unfinished estimate protection handoff

Parent checkpoint: 3b4b8d98cd781f5951c6aa055372a2a567b946ff. Date: 2026-10-14 UTC. Development branch: work/fire-business-app-parity-2026-10-08.

Before this change, closing New Estimate cleared entered work without confirmation and scheduled a delayed reset that could erase a quickly reopened form. Changed forms now require explicit discard approval. Cancel keeps entered customer details, services, quantities, prices and discounts. A pending save prevents closing, and a failed save retains the form. Deliberate closing resets immediately to the correct blank or preselected-customer baseline. Existing estimate calculations and API writes are unchanged.

Final validation across LIVE, Doomsday and staging isolated candidates: 96/96 actual framework Chromium checks, 207/207 synthetic financial regressions, 3/3 TypeScript checks and 3/3 full builds. All 131 shared source files match. The new browser workflow exercises canceled discard, deliberate discard, rapid reopening, a held request and a synthetic failed save. An initial test navigation error was corrected before the successful final runs. See UNFINISHED_ESTIMATE_PROTECTION_EVIDENCE.json for exact scope and hashes.

This is in-memory close protection, not durable reload recovery. Invoice/customer edit dialogs are not changed. Encrypted Customers recovery and resolution controls remain as verified in the parent; no broader enablement was added. Source parity does not establish deployed parity.

The multiple-property audit found that estimates currently join the customer's mutable address. CUSTOMER_PROPERTY_RELATIONSHIP_AUDIT.md documents the proposed smallest property relationship and historical location snapshot. No properties feature or migration was implemented. Next priority: review the candidate schema and historical address compatibility before allowing property switching; no automatic historical backfill or production migration. Continue the remaining release gates from retained evidence without advancing incomplete gates.

Production apps, calculator, financial records, Stripe, databases, device vaults and original backups remain untouched. No deployments, paid services, device recovery, resets or storage clearing. Bottom-of-screen shaking remains tracked; no CSS changes. Official release readiness remains 30% (3/10 gates).
