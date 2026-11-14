/** Owner financial safety boundary for a deployed schema missing the refund ledger.
 *
 * A successful result proves only that four required schema object NAMES exist.
 * It is NOT provider-authenticated Gate 5 DDL/index/journal equivalence, and it
 * never creates a table, applies a migration or connects to Stripe.
 */
const REQUIRED_OBJECTS = [
  ["payment_refunds", "table", "payment_refunds"],
  ["idx_payment_refunds_payment_status", "index", "payment_refunds"],
  ["idx_payment_refunds_estimate_status", "index", "payment_refunds"],
  ["idx_payment_refunds_provider", "index", "payment_refunds"],
] as const;

export async function refundLedgerObjectsPresent(db: Cloudflare.Env["DB"]): Promise<boolean> {
  try {
    // Deliberately read sqlite_master, not the refund table itself: this query
    // continues to work on existing LIVE where payment_refunds is absent.
    const found = await db.prepare(`SELECT name, type, tbl_name AS tableName
      FROM sqlite_master
      WHERE name IN ('payment_refunds','idx_payment_refunds_payment_status',
        'idx_payment_refunds_estimate_status','idx_payment_refunds_provider')
        AND type IN ('table','index')`).all<{ name: string; type: string; tableName: string }>();
    if (!Array.isArray(found.results) || found.results.length !== REQUIRED_OBJECTS.length) return false;
    const names = new Set<string>();
    for (const row of found.results) {
      if (!row || typeof row.name !== "string" || names.has(row.name)) return false;
      names.add(row.name);
    }
    return REQUIRED_OBJECTS.every(([name, type, tableName]) =>
      found.results.some((row) => row.name === name && row.type === type && row.tableName === tableName));
  } catch {
    // When schema introspection itself fails, fail closed before a financial
    // action. Never treat a failed query as an empty balance or a success.
    return false;
  }
}

export function refundLedgerNotReady(): Response {
  return Response.json({
    code: "REFUND_LEDGER_SCHEMA_INCOMPLETE",
    error: "Payment and refund history are temporarily unavailable because the refund ledger needs verified database review. Do not retry refunds or enter another payment until the owner confirms the database migration history.",
    retryable: false,
  }, { status: 503, headers: { "cache-control": "no-store" } });
}
