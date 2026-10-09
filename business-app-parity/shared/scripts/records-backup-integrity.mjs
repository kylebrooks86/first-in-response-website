// Keep refund/relationship semantics aligned with app/api/backup/route.ts; regression tests compare both.
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function validateBackupRelationships(tables) {
    const rows = (table) => Array.isArray(tables[table]) ? tables[table].filter(isRecord) : [];
    const ids = (table) => new Set(rows(table).map(row => String(row.id ?? "")));
    const customers = ids("customers"), estimates = ids("estimates"), invoices = ids("invoices");
    const estimateOwners = new Map(rows("estimates").map(row => [String(row.id), String(row.customer_id)]));
    const checks = [
        ["estimates", "customer_id", customers, false], ["invoices", "customer_id", customers, false],
        ["invoices", "estimate_id", estimates, false], ["estimate_items", "estimate_id", estimates, false],
        ["invoice_items", "invoice_id", invoices, false], ["invoice_revisions", "invoice_id", invoices, false],
        ["payments", "estimate_id", estimates, false], ["payment_checkout_sessions", "estimate_id", estimates, false],
        ["customer_notes", "customer_id", customers, false], ["customer_messages", "customer_id", customers, false],
        ["customer_messages", "estimate_id", estimates, true], ["customer_photos", "customer_id", customers, false],
        ["customer_photos", "estimate_id", estimates, true], ["job_reports", "customer_id", customers, false],
        ["job_reports", "estimate_id", estimates, false], ["estimate_change_requests", "customer_id", customers, false],
        ["estimate_change_requests", "estimate_id", estimates, false], ["notifications", "customer_id", customers, true],
        ["notifications", "estimate_id", estimates, true], ["tasks", "customer_id", customers, true],
        ["tasks", "estimate_id", estimates, true], ["expenses", "estimate_id", estimates, true],
    ];
    for (const [table, column, known, optional] of checks)
        for (const row of rows(table)) {
            if (optional && row[column] == null)
                continue;
            if (!known.has(String(row[column] ?? "")))
                return `${table} ${row.id} references missing ${column}.`;
        }
    for (const table of ["invoices", "job_reports", "estimate_change_requests", "customer_photos", "customer_messages"])
        for (const row of rows(table))
            if (row.estimate_id != null && estimateOwners.get(String(row.estimate_id)) !== String(row.customer_id))
                return `${table} ${row.id} has inconsistent customer/estimate ownership.`;
    const providers = new Set();
    for (const row of rows("payments")) {
        const provider = String(row.provider_id ?? "");
        if (!provider.startsWith("cs_") && !provider.startsWith("refund:"))
            continue;
        if (providers.has(provider))
            return `Duplicate Stripe payment provider ${provider}.`;
        providers.add(provider);
    }
    return null;
}
function validateRefundIntegrity(tables) {
    const refundRows = tables.payment_refunds;
    if (refundRows === undefined)
        return null;
    if (!Array.isArray(refundRows))
        return "Backup payment_refunds must be an array.";
    const payments = Array.isArray(tables.payments) ? tables.payments.filter(isRecord) : [];
    const estimates = Array.isArray(tables.estimates) ? tables.estimates.filter(isRecord) : [];
    const paymentById = new Map(payments.map((row) => [String(row.id ?? ""), row]));
    const estimateIds = new Set(estimates.map((row) => String(row.id ?? "")));
    const refundIds = new Set();
    const providerRefundIds = new Set();
    const refundPaymentProviders = new Set();
    const succeededRefundProviders = new Set();
    const reservedByPayment = new Map();
    for (const [index, raw] of refundRows.entries()) {
        if (!isRecord(raw))
            return `Backup payment_refunds[${index}] is invalid.`;
        const id = String(raw.id ?? "");
        const paymentId = String(raw.payment_id ?? "");
        const estimateId = String(raw.estimate_id ?? "");
        const amount = Number(raw.amount_cents);
        const mode = String(raw.mode ?? "");
        const status = String(raw.status ?? "");
        const providerRefundId = raw.provider_refund_id == null ? "" : String(raw.provider_refund_id);
        if (!id || refundIds.has(id))
            return `Backup contains a duplicate or blank refund request ID at row ${index}.`;
        refundIds.add(id);
        const payment = paymentById.get(paymentId);
        if (!payment)
            return `Refund ${id} references missing payment ${paymentId}.`;
        if (!estimateIds.has(estimateId))
            return `Refund ${id} references missing estimate ${estimateId}.`;
        if (String(payment.estimate_id ?? "") !== estimateId)
            return `Refund ${id} has inconsistent payment/estimate ownership.`;
        const originalAmount = Number(payment.amount_cents);
        if (!Number.isSafeInteger(originalAmount) || originalAmount <= 0 || String(payment.status ?? "") !== "paid")
            return `Refund ${id} does not reference a valid positive paid payment.`;
        if (!Number.isSafeInteger(amount) || amount <= 0)
            return `Refund ${id} has an invalid amount.`;
        if (!["stripe", "manual"].includes(mode))
            return `Refund ${id} has invalid mode.`;
        if (!["pending", "succeeded", "failed"].includes(status))
            return `Refund ${id} has invalid status.`;
        if (providerRefundId) {
            if (providerRefundIds.has(providerRefundId))
                return `Duplicate provider refund ID ${providerRefundId}.`;
            providerRefundIds.add(providerRefundId);
        }
        if (status === "pending" || status === "succeeded") {
            const nextReserved = (reservedByPayment.get(paymentId) ?? 0) + amount;
            if (!Number.isSafeInteger(nextReserved) || nextReserved > originalAmount)
                return `Refund reservations exceed original payment ${paymentId}.`;
            reservedByPayment.set(paymentId, nextReserved);
        }
        if (status === "succeeded") {
            const expectedProvider = `refund:${paymentId}:${id}`;
            const ledgerRows = payments.filter((row) => String(row.provider_id ?? "") === expectedProvider);
            if (ledgerRows.length !== 1)
                return `Succeeded refund ${id} must have exactly one matching negative payment ledger row.`;
            const expectedLedgerType = String(payment.type ?? "") === "Tip" ? "Tip Refund" : "Refund";
            if (String(ledgerRows[0].estimate_id ?? "") !== estimateId || Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status ?? "") !== "paid" || String(ledgerRows[0].type ?? "") !== expectedLedgerType)
                return `Succeeded refund ${id} has a mismatched negative payment ledger row.`;
            succeededRefundProviders.add(expectedProvider);
        }
    }
    for (const payment of payments) {
        const provider = String(payment.provider_id ?? "");
        if (!provider.startsWith("refund:"))
            continue;
        if (refundPaymentProviders.has(provider))
            return `Duplicate refund ledger provider ${provider}.`;
        refundPaymentProviders.add(provider);
        if (!succeededRefundProviders.has(provider))
            return `Orphan refund ledger provider ${provider}.`;
    }
    return null;
}

export {validateBackupRelationships,validateRefundIntegrity};
export function validateRecordIdentities(tables){
 for(const [table,rows] of Object.entries(tables)){
  if(!Array.isArray(rows))return `Backup ${table} must be an array.`;
  const seen=new Set();const key=table==='message_templates'?'key':'id';
  for(const row of rows){
   if(!isRecord(row)||typeof row[key]!=='string'||!row[key].trim())return `Backup ${table} contains an invalid ${key}.`;
   if(seen.has(row[key]))return `Backup ${table} contains duplicate ${key} ${row[key]}.`;
   seen.add(row[key]);
  }
 }
 return null;
}
export function assertBackupIntegrity(tables){
 const error=validateRecordIdentities(tables)||validateBackupRelationships(tables)||validateRefundIntegrity(tables);
 if(error)throw new Error(error);
}
