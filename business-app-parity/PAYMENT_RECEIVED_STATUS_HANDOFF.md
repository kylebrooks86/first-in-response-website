# Received payment status — October 9, 2026

Fixed Payments summaries counting pending/failed rows as received. Total recorded, Net tips and processing report now use status=paid entries only. Paid principal refunds and tip refunds remain negative ledger entries in summaries. All transaction history stays visible, now with status; non-paid rows do not show net received or refund controls. No API writes or policy changes.

98 new assertions per target, 294/294 across isolated LIVE/Doomsday/staging. Actual Payments GET uses synthetic fully migrated in-memory SQLite; actual PaymentsView executed after AST extraction with seeded state. Eight fixtures cover mixed/only-pending/only-failed, paid refunds, empty, zero, unknown and unpaid refunds. Parent component fails negative control. Payment mobile and processing-fee regressions pass: 9/9 selected suite runs, TypeScript 3/3, completed builds 3/3 and shared source 119/119. Evidence records candidate commits, paths and hashes. No deployed or iPhone evidence claimed; historical release manifest remains stale for newer snapshots.

Overall verified readiness: 30% (3/10 release gates). Formal deployed/mobile parity 0/32; complete remote schema/journals 0/3. No deployments, remote database writes, Stripe mutations or paid resource changes.

Next bounded task: reproduce the approved/scheduled job with existing invoice edge case. UI and dashboard treat invoice total as due; manual POST and atomic insert cap it at deposit until completed. Use local synthetic fixtures to determine reachable workflow and align collection behavior without weakening payment guards or deposit exceptions. Preserve all versions and target adapters. Regular chat may independently review this diff and evidence read-only.
