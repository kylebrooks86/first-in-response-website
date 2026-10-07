import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const TABLES = [
  ["customers", ["id", "name", "email", "phone", "address", "lead_source", "created_at"]],
  ["estimates", ["id", "customer_id", "status", "subtotal_cents", "discount_cents", "appreciation_discount", "additional_discount_type", "additional_discount_value", "total_cents", "deposit_cents", "scheduled_at", "share_token", "first_viewed_at", "accepted_at", "signed_name", "signed_at", "contract_initials", "photo_release", "contract_version", "created_at"]],
  ["customer_notes", ["id", "customer_id", "body", "created_at"]],
  ["invoices", ["id", "estimate_id", "customer_id", "status", "subtotal_cents", "discount_cents", "discount_type", "discount_value", "total_cents", "due_at", "share_token", "first_viewed_at", "created_at"]],
  ["invoice_items", ["id", "invoice_id", "name", "description", "quantity", "unit", "total_cents"]],
  ["invoice_revisions", ["id", "invoice_id", "subtotal_cents", "discount_cents", "discount_type", "discount_value", "total_cents", "due_at", "status", "items_json", "created_at"]],
  ["payment_checkout_sessions", ["id", "estimate_id", "type", "amount_cents", "status", "created_at", "expired_at"]],
  ["estimate_items", ["id", "estimate_id", "name", "description", "quantity", "unit", "total_cents"]],
  ["payments", ["id", "estimate_id", "type", "amount_cents", "status", "provider_id", "created_at", "processing_fee_cents", "gross_received_cents", "bundled_tip_cents", "processing_method"]],
  ["payment_refunds", ["id", "payment_id", "estimate_id", "amount_cents", "mode", "status", "provider_refund_id", "note", "created_at", "completed_at"]],
  ["customer_messages", ["id", "customer_id", "estimate_id", "channel", "template", "body", "created_at"]],
  ["notifications", ["id", "type", "title", "body", "customer_id", "estimate_id", "read_at", "resolved_at", "resolution_note", "created_at"]],
  ["message_templates", ["key", "subject", "body", "updated_at"]],
  ["estimate_change_requests", ["id", "estimate_id", "customer_id", "message", "status", "created_at"]],
  ["tasks", ["id", "title", "customer_id", "estimate_id", "due_at", "status", "notes", "created_at", "completed_at"]],
  ["expenses", ["id", "estimate_id", "category", "description", "amount_cents", "incurred_at", "created_at"]],
  ["job_reports", ["id", "estimate_id", "customer_id", "checklist", "notes", "airflow_before", "airflow_after", "status", "created_at", "completed_at"]],
];

const args = process.argv.slice(2);
const valueAfter = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const has = (name) => args.includes(name);
const backupPath = valueAfter("--backup");
const configPath = valueAfter("--config") || "dist/server/wrangler.independent.json";
const apply = has("--apply");
const local = has("--local");
const remote = has("--remote");
const persistTo = valueAfter("--persist-to") || ".wrangler/state";
const restoreAudit={attemptId:randomUUID(),phase:"input_validation",writesAttempted:false,insertedRecordsExpected:0,verifiedRecords:0,lifecycleNotificationUniquenessVerified:false,legacyLifecycleNotificationsSkipped:0};

if (!backupPath || local === remote) {
  console.error("Usage: npm run restore:records -- --backup <json> (--local | --remote) [--config <path>] [--persist-to <path>] [--apply] [--confirm-database <name>]");
  process.exit(1);
}

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const absoluteBackup = resolve(backupPath);
const absoluteConfig = resolve(configPath);
const config = JSON.parse(await readFile(absoluteConfig, "utf8"));
const database = config.d1_databases?.find((item) => item.binding === "DB");
if (!database?.database_name || !database.database_id || database.database_id === "00000000-0000-4000-8000-000000000000") {
  console.error("The independent Wrangler configuration must contain a non-placeholder DB resource.");
  process.exit(1);
}
if (remote && apply && valueAfter("--confirm-database") !== database.database_name) {
  console.error(`Remote apply requires --confirm-database ${database.database_name}`);
  process.exit(1);
}

const wrangler = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const modeArgs = local ? ["--local", "--persist-to", persistTo] : ["--remote"];
function run(commandArgs) {
  return spawnSync(process.execPath, [wrangler, ...commandArgs], { cwd: projectRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
function fail(result, context) {
  const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  throw new Error(`${context}${detail ? `\n${detail}` : ""}`);
}
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Backup contains a non-finite number.");
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

const backupStat = await stat(absoluteBackup).catch(() => null);
if (!backupStat?.isFile()) throw new Error(`Records backup not found: ${absoluteBackup}`);
if (backupStat.size > 5_000_000) throw new Error("That backup is larger than the 5 MB restore limit.");
const payload = JSON.parse(await readFile(absoluteBackup, "utf8"));
let backupTables = null;
if (payload?.format === "fire-app-records-backup" && payload?.version === 1 && payload.tables && typeof payload.tables === "object") {
  backupTables = payload.tables;
} else if (payload?.backup_format === "FIRE App live database snapshot" && payload?.format_version === 1 && payload.tables && typeof payload.tables === "object" && payload?.verification?.all_tables_complete === true && payload?.verification?.truncated === false) {
  backupTables = Object.fromEntries(Object.entries(payload.tables).map(([table, value]) => {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error(`Snapshot table ${table} is invalid.`);
    return [table, value.rows];
  }));
}
if (!backupTables) throw new Error("This is not a valid or complete FIRE App records backup.");

const LIFECYCLE_NOTIFICATION_TYPES=new Set(["estimate_viewed","invoice_viewed","estimate_accepted"]);
function normalizeLegacyLifecycleNotifications(rows){
  if(!Array.isArray(rows))return {rows,skipped:0};
  const passthrough=[];
  const winnerByKey=new Map();
  let skipped=0;
  const rank=(row)=>{
    const created=Date.parse(String(row?.created_at??""));
    return [Number.isFinite(created)?created:Number.MAX_SAFE_INTEGER,String(row?.id??"")];
  };
  for(const row of rows){
    if(!row||typeof row!=="object"||Array.isArray(row)){passthrough.push(row);continue;}
    const type=String(row.type??"");
    const estimateId=row.estimate_id==null?"":String(row.estimate_id);
    if(!estimateId||!LIFECYCLE_NOTIFICATION_TYPES.has(type)){passthrough.push(row);continue;}
    const key=`${type}\u0000${estimateId}`;
    const existing=winnerByKey.get(key);
    if(!existing){winnerByKey.set(key,row);continue;}
    const [aTime,aId]=rank(existing);
    const [bTime,bId]=rank(row);
    if(bTime<aTime||(bTime===aTime&&bId<aId)){
      winnerByKey.set(key,row);
    }
    skipped++;
  }
  return {rows:[...passthrough,...winnerByKey.values()],skipped};
}

const lifecycleNormalization=normalizeLegacyLifecycleNotifications(backupTables.notifications);
backupTables.notifications=lifecycleNormalization.rows;
restoreAudit.legacyLifecycleNotificationsSkipped=lifecycleNormalization.skipped;

if (Array.isArray(backupTables.payment_refunds)) {
  const payments = Array.isArray(backupTables.payments) ? backupTables.payments : [];
  const estimates = Array.isArray(backupTables.estimates) ? backupTables.estimates : [];
  const paymentById = new Map(payments.map((row) => [String(row.id), row]));
  const estimateIds = new Set(estimates.map((row) => String(row.id)));
  const refundIds = new Set();
  const providerRefundIds = new Set();
  const refundPaymentProviders = new Set();
  const succeededRefundProviders = new Set();
  const reservedByPayment = new Map();

  for (const row of backupTables.payment_refunds) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("The payment_refunds backup contains an invalid record.");
    const id = String(row.id ?? "");
    const paymentId = String(row.payment_id ?? "");
    const estimateId = String(row.estimate_id ?? "");
    const amount = Number(row.amount_cents);
    const mode = String(row.mode ?? "");
    const status = String(row.status ?? "");
    const providerRefundId = row.provider_refund_id == null ? "" : String(row.provider_refund_id);

    if (!id || refundIds.has(id)) throw new Error("The backup contains duplicate or blank refund request IDs.");
    refundIds.add(id);
    const originalPayment=paymentById.get(paymentId);
    if (!originalPayment) throw new Error(`Refund ${id} references missing payment ${paymentId}.`);
    if (!estimateIds.has(estimateId)) throw new Error(`Refund ${id} references missing estimate ${estimateId}.`);
    if (String(originalPayment.estimate_id ?? "") !== estimateId) throw new Error(`Refund ${id} has inconsistent payment/estimate ownership.`);
    const originalAmount=Number(originalPayment.amount_cents);
    if (!Number.isSafeInteger(originalAmount) || originalAmount<=0 || String(originalPayment.status)!=="paid") throw new Error(`Refund ${id} does not reference a valid positive paid payment.`);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Refund ${id} has an invalid amount.`);
    if (!["stripe","manual"].includes(mode)) throw new Error(`Refund ${id} has invalid mode.`);
    if (!["pending","succeeded","failed"].includes(status)) throw new Error(`Refund ${id} has invalid status.`);
    if (providerRefundId) {
      if (providerRefundIds.has(providerRefundId)) throw new Error(`Duplicate provider refund id ${providerRefundId}.`);
      providerRefundIds.add(providerRefundId);
    }
    if (status === "pending" || status === "succeeded") {
      const nextReserved=(reservedByPayment.get(paymentId)??0)+amount;
      if (!Number.isSafeInteger(nextReserved) || nextReserved>originalAmount) throw new Error(`Refund reservations exceed original payment ${paymentId}.`);
      reservedByPayment.set(paymentId,nextReserved);
    }
    if (status === "succeeded") {
      const expectedProvider = `refund:${paymentId}:${id}`;
      const ledgerRows = payments.filter((payment) => String(payment.provider_id ?? "") === expectedProvider);
      if (ledgerRows.length !== 1 || Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status) !== "paid")
        throw new Error(`Succeeded refund ${id} does not have one exact matching negative payment ledger row.`);
      succeededRefundProviders.add(expectedProvider);
    }
  }

  for (const payment of payments) {
    const provider = String(payment.provider_id ?? "");
    if (!provider.startsWith("refund:")) continue;
    if (refundPaymentProviders.has(provider)) throw new Error(`Duplicate refund ledger provider ${provider}.`);
    refundPaymentProviders.add(provider);
    if (!succeededRefundProviders.has(provider)) throw new Error(`Orphan refund ledger provider ${provider}.`);
  }
}

const restoredAt = new Date().toISOString();
const plans = [];
for (const [table, columns] of TABLES) {
  const rows = backupTables[table];
  if (!Array.isArray(rows)) { if (table === "invoice_items" || table === "invoice_revisions" || table === "payment_checkout_sessions" || table === "payment_refunds") continue; throw new Error(`The backup is missing the ${table} records.`); }
  for (const candidate of rows) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error(`The ${table} backup contains an invalid record.`);
    const values = columns.map((column) => {
      const value=candidate[column];
          if(table==="payments"&&["processing_fee_cents","gross_received_cents","bundled_tip_cents","processing_method"].includes(column)&&value===undefined)return null;
      if(value!==undefined)return value;
      if(table==="invoices"&&column==="subtotal_cents")return candidate.total_cents??0;
      if(table==="invoices"&&column==="discount_cents")return 0;
      if(table==="invoices"&&column==="discount_type")return "dollar";
      if(table==="invoices"&&column==="discount_value")return 0;
      if(table==="estimates"&&column==="appreciation_discount")return 0;
      if(table==="estimates"&&column==="additional_discount_type")return "percent";
      if(table==="estimates"&&column==="additional_discount_value")return 0;
      if(table==="notifications"&&column==="resolved_at")return null;
      if(table==="notifications"&&column==="resolution_note")return null;
      if(table==="payment_checkout_sessions"&&column==="status"&&candidate.status==="open")return "expired";
          if(table==="payment_refunds"&&column==="status"&&candidate.status==="pending")return "failed";
      if(table==="payment_checkout_sessions"&&column==="expired_at"&&candidate.status==="open")return restoredAt;
      return value;
    });
    if (values.some((value) => value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number")) throw new Error(`The ${table} backup contains an invalid field.`);
    const identityColumn = table === "message_templates" ? "key" : "id";
    const identity = candidate[identityColumn];
    if (typeof identity !== "string" || !identity) throw new Error(`The ${table} backup contains a record without a valid ${identityColumn}.`);
    plans.push({ table, columns, values, identityColumn, identity });
  }
}
if (plans.length > 5_000) throw new Error("This backup contains more than 5,000 records and requires a managed restore.");

restoreAudit.phase="target_conflict_validation";
const existingByTable = new Map();
for (const [table] of TABLES) {
  const identityColumn = table === "message_templates" ? "key" : "id";
  const result = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--json", "--command", `SELECT ${identityColumn} AS identity FROM ${table}`]);
  if (result.status !== 0) fail(result, `Could not inspect target table ${table}.`);
  const parsed = JSON.parse(result.stdout);
  existingByTable.set(table, new Set((parsed[0]?.results || []).map((row) => String(row.identity))));
}
const targetCustomerIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,name,email,phone,address,lead_source AS leadSource,created_at AS createdAt FROM customers"]);
if(targetCustomerIdentityResult.status!==0)fail(targetCustomerIdentityResult,"Could not inspect target customer identities.");
const targetCustomerRows=JSON.parse(targetCustomerIdentityResult.stdout)[0]?.results||[];
const targetCustomerById=new Map(targetCustomerRows.map((row)=>[String(row.id),row]));

const targetCustomerNoteResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes"]);
if(targetCustomerNoteResult.status!==0)fail(targetCustomerNoteResult,"Could not inspect target customer-note identities.");
const targetCustomerNoteRows=JSON.parse(targetCustomerNoteResult.stdout)[0]?.results||[];
const targetCustomerNoteById=new Map(targetCustomerNoteRows.map((row)=>[String(row.id),row]));

const targetCustomerMessageResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages"]);
if(targetCustomerMessageResult.status!==0)fail(targetCustomerMessageResult,"Could not inspect target customer-message identities.");
const targetCustomerMessageRows=JSON.parse(targetCustomerMessageResult.stdout)[0]?.results||[];
const targetCustomerMessageById=new Map(targetCustomerMessageRows.map((row)=>[String(row.id),row]));

const targetNotificationResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,type,title,body,customer_id AS customerId,estimate_id AS estimateId,created_at AS createdAt FROM notifications"]);
if(targetNotificationResult.status!==0)fail(targetNotificationResult,"Could not inspect target notification identities.");
const targetNotificationRows=JSON.parse(targetNotificationResult.stdout)[0]?.results||[];
const targetNotificationById=new Map(targetNotificationRows.map((row)=>[String(row.id),row]));

const targetTemplateResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT key,subject,body,updated_at AS updatedAt FROM message_templates"]);
if(targetTemplateResult.status!==0)fail(targetTemplateResult,"Could not inspect target message-template identities.");
const targetTemplateRows=JSON.parse(targetTemplateResult.stdout)[0]?.results||[];
const targetTemplateByKey=new Map(targetTemplateRows.map((row)=>[String(row.key),row]));

const targetEstimateIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,customer_id AS customerId,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents,share_token AS shareToken FROM estimates"]);
if(targetEstimateIdentityResult.status!==0)fail(targetEstimateIdentityResult,"Could not inspect target estimate identities.");
const targetEstimateRows=JSON.parse(targetEstimateIdentityResult.stdout)[0]?.results||[];
const targetEstimateById=new Map(targetEstimateRows.map((row)=>[String(row.id),row]));
const targetEstimateShareToId=new Map(targetEstimateRows.filter((row)=>row.shareToken).map((row)=>[String(row.shareToken),String(row.id)]));

const targetInvoiceIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,customer_id AS customerId,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,share_token AS shareToken FROM invoices"]);
if(targetInvoiceIdentityResult.status!==0)fail(targetInvoiceIdentityResult,"Could not inspect target invoice identities.");
const targetInvoiceRows=JSON.parse(targetInvoiceIdentityResult.stdout)[0]?.results||[];
const targetInvoiceById=new Map(targetInvoiceRows.map((row)=>[String(row.id),row]));
const targetInvoiceEstimateToId=new Map(targetInvoiceRows.map((row)=>[String(row.estimateId),String(row.id)]));
const targetInvoiceShareToId=new Map(targetInvoiceRows.filter((row)=>row.shareToken).map((row)=>[String(row.shareToken),String(row.id)]));

const targetCheckoutIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents FROM payment_checkout_sessions"]);
if(targetCheckoutIdentityResult.status!==0)fail(targetCheckoutIdentityResult,"Could not inspect target checkout identities.");
const targetCheckoutRows=JSON.parse(targetCheckoutIdentityResult.stdout)[0]?.results||[];
const targetCheckoutById=new Map(targetCheckoutRows.map((row)=>[String(row.id),row]));

const targetEstimateItemResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,name,quantity,unit,total_cents AS totalCents FROM estimate_items"]);
if(targetEstimateItemResult.status!==0)fail(targetEstimateItemResult,"Could not inspect target estimate-item identities.");
const targetEstimateItemRows=JSON.parse(targetEstimateItemResult.stdout)[0]?.results||[];
const targetEstimateItemById=new Map(targetEstimateItemRows.map((row)=>[String(row.id),row]));

const targetInvoiceItemResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,invoice_id AS invoiceId,name,quantity,unit,total_cents AS totalCents FROM invoice_items"]);
if(targetInvoiceItemResult.status!==0)fail(targetInvoiceItemResult,"Could not inspect target invoice-item identities.");
const targetInvoiceItemRows=JSON.parse(targetInvoiceItemResult.stdout)[0]?.results||[];
const targetInvoiceItemById=new Map(targetInvoiceItemRows.map((row)=>[String(row.id),row]));

const targetTaskResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,customer_id AS customerId,estimate_id AS estimateId,title,created_at AS createdAt FROM tasks"]);
if(targetTaskResult.status!==0)fail(targetTaskResult,"Could not inspect target task identities.");
const targetTaskRows=JSON.parse(targetTaskResult.stdout)[0]?.results||[];
const targetTaskById=new Map(targetTaskRows.map((row)=>[String(row.id),row]));

const targetExpenseResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,category,description,amount_cents AS amountCents,incurred_at AS incurredAt FROM expenses"]);
if(targetExpenseResult.status!==0)fail(targetExpenseResult,"Could not inspect target expense identities.");
const targetExpenseRows=JSON.parse(targetExpenseResult.stdout)[0]?.results||[];
const targetExpenseById=new Map(targetExpenseRows.map((row)=>[String(row.id),row]));

const targetJobReportResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,status FROM job_reports"]);
if(targetJobReportResult.status!==0)fail(targetJobReportResult,"Could not inspect target job-report identities.");
const targetJobReportRows=JSON.parse(targetJobReportResult.stdout)[0]?.results||[];
const targetJobReportById=new Map(targetJobReportRows.map((row)=>[String(row.id),row]));

const targetChangeRequestResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,customer_id AS customerId,message FROM estimate_change_requests"]);
if(targetChangeRequestResult.status!==0)fail(targetChangeRequestResult,"Could not inspect target change-request identities.");
const targetChangeRequestRows=JSON.parse(targetChangeRequestResult.stdout)[0]?.results||[];
const targetChangeRequestById=new Map(targetChangeRequestRows.map((row)=>[String(row.id),row]));

const targetRevisionIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,invoice_id AS invoiceId,total_cents AS totalCents,items_json AS itemsJson FROM invoice_revisions"]);
if(targetRevisionIdentityResult.status!==0)fail(targetRevisionIdentityResult,"Could not inspect target invoice revision identities.");
const targetRevisionRows=JSON.parse(targetRevisionIdentityResult.stdout)[0]?.results||[];
const targetRevisionById=new Map(targetRevisionRows.map((row)=>[String(row.id),row]));

const targetRefundIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,payment_id AS paymentId,estimate_id AS estimateId,amount_cents AS amountCents,mode FROM payment_refunds"]);
if(targetRefundIdentityResult.status!==0)fail(targetRefundIdentityResult,"Could not inspect target refund identities.");
const targetRefundIdentityRows=JSON.parse(targetRefundIdentityResult.stdout)[0]?.results||[];
const targetRefundById=new Map(targetRefundIdentityRows.map((row)=>[String(row.id),row]));

const targetPaymentIdentityResult=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,estimate_id AS estimateId,amount_cents AS amountCents,provider_id AS providerId FROM payments"]);
if(targetPaymentIdentityResult.status!==0)fail(targetPaymentIdentityResult,"Could not inspect target payment identities.");
const targetPaymentIdentityRows=JSON.parse(targetPaymentIdentityResult.stdout)[0]?.results||[];
const targetPaymentById=new Map(targetPaymentIdentityRows.map((row)=>[String(row.id),row]));

for(const plan of plans){
  const get=(name)=>plan.values[plan.columns.indexOf(name)];
  const same=(a,b)=>(a??null)===(b??null);
  if(plan.table==="customers"&&targetCustomerById.has(plan.identity)){
    const existing=targetCustomerById.get(plan.identity);
    if(String(existing.name)!==String(get("name"))||!same(existing.email,get("email"))||!same(existing.phone,get("phone"))||!same(existing.address,get("address"))||String(existing.leadSource)!==String(get("lead_source"))||String(existing.createdAt)!==String(get("created_at")))
      throw new Error(`Restore conflict: target customer ${plan.identity} has different immutable identity/contact values.`);
  }
  if(plan.table==="customer_notes"&&targetCustomerNoteById.has(plan.identity)){
    const existing=targetCustomerNoteById.get(plan.identity);
    if(String(existing.customerId)!==String(get("customer_id"))||String(existing.body)!==String(get("body"))||String(existing.createdAt)!==String(get("created_at")))
      throw new Error(`Restore conflict: target customer note ${plan.identity} has different immutable customer/body/created values.`);
  }
  if(plan.table==="customer_messages"&&targetCustomerMessageById.has(plan.identity)){
    const existing=targetCustomerMessageById.get(plan.identity);
    if(String(existing.customerId)!==String(get("customer_id"))||!same(existing.estimateId,get("estimate_id"))||String(existing.channel)!==String(get("channel"))||String(existing.template)!==String(get("template"))||String(existing.body)!==String(get("body"))||String(existing.createdAt)!==String(get("created_at")))
      throw new Error(`Restore conflict: target customer message ${plan.identity} has different immutable relationship/content values.`);
  }
  if(plan.table==="notifications"&&targetNotificationById.has(plan.identity)){
    const existing=targetNotificationById.get(plan.identity);
    if(String(existing.type)!==String(get("type"))||String(existing.title)!==String(get("title"))||String(existing.body)!==String(get("body"))||!same(existing.customerId,get("customer_id"))||!same(existing.estimateId,get("estimate_id"))||String(existing.createdAt)!==String(get("created_at")))
      throw new Error(`Restore conflict: target notification ${plan.identity} has different immutable type/content/relationship values.`);
  }
  if(plan.table==="message_templates"&&targetTemplateByKey.has(plan.identity)){
    const existing=targetTemplateByKey.get(plan.identity);
    if(String(existing.subject)!==String(get("subject"))||String(existing.body)!==String(get("body"))||String(existing.updatedAt)!==String(get("updated_at")))
      throw new Error(`Restore conflict: target message template ${plan.identity} has different saved content/version values.`);
  }
  if(plan.table==="estimates"&&targetEstimateById.has(plan.identity)){
    const existing=targetEstimateById.get(plan.identity);
    if(String(existing.customerId)!==String(get("customer_id"))||Number(existing.subtotalCents)!==Number(get("subtotal_cents"))||Number(existing.discountCents)!==Number(get("discount_cents"))||Number(existing.totalCents)!==Number(get("total_cents"))||Number(existing.depositCents)!==Number(get("deposit_cents"))||(existing.shareToken??null)!==(get("share_token")??null))
      throw new Error(`Restore conflict: target estimate ${plan.identity} has different immutable customer/billing/share-token values.`);
  }
  if(plan.table==="invoices"&&targetInvoiceById.has(plan.identity)){
    const existing=targetInvoiceById.get(plan.identity);
    if(String(existing.estimateId)!==String(get("estimate_id"))||String(existing.customerId)!==String(get("customer_id"))||Number(existing.subtotalCents)!==Number(get("subtotal_cents"))||Number(existing.discountCents)!==Number(get("discount_cents"))||Number(existing.totalCents)!==Number(get("total_cents"))||(existing.shareToken??null)!==(get("share_token")??null))
      throw new Error(`Restore conflict: target invoice ${plan.identity} has different immutable estimate/customer/billing/share-token values.`);
  }
  if(plan.table==="payment_checkout_sessions"&&targetCheckoutById.has(plan.identity)){
    const existing=targetCheckoutById.get(plan.identity);
    if(String(existing.estimateId)!==String(get("estimate_id"))||String(existing.type)!==String(get("type"))||Number(existing.amountCents)!==Number(get("amount_cents")))
      throw new Error(`Restore conflict: target checkout ${plan.identity} has different immutable estimate/type/amount values.`);
  }
  if(plan.table==="invoice_revisions"&&targetRevisionById.has(plan.identity)){
    const existing=targetRevisionById.get(plan.identity);
    if(String(existing.invoiceId)!==String(get("invoice_id"))||Number(existing.totalCents)!==Number(get("total_cents"))||String(existing.itemsJson)!==String(get("items_json")))
      throw new Error(`Restore conflict: target invoice revision ${plan.identity} has different immutable invoice/total/items values.`);
  }
  if(plan.table==="estimate_items"&&targetEstimateItemById.has(plan.identity)){
    const existing=targetEstimateItemById.get(plan.identity);
    if(String(existing.estimateId)!==String(get("estimate_id"))||String(existing.name)!==String(get("name"))||Number(existing.quantity)!==Number(get("quantity"))||String(existing.unit)!==String(get("unit"))||Number(existing.totalCents)!==Number(get("total_cents")))
      throw new Error(`Restore conflict: target estimate item ${plan.identity} has different immutable parent/service/amount values.`);
  }
  if(plan.table==="invoice_items"&&targetInvoiceItemById.has(plan.identity)){
    const existing=targetInvoiceItemById.get(plan.identity);
    if(String(existing.invoiceId)!==String(get("invoice_id"))||String(existing.name)!==String(get("name"))||Number(existing.quantity)!==Number(get("quantity"))||String(existing.unit)!==String(get("unit"))||Number(existing.totalCents)!==Number(get("total_cents")))
      throw new Error(`Restore conflict: target invoice item ${plan.identity} has different immutable parent/service/amount values.`);
  }
  if(plan.table==="tasks"&&targetTaskById.has(plan.identity)){
    const existing=targetTaskById.get(plan.identity);
    if((existing.customerId??null)!==(get("customer_id")??null)||(existing.estimateId??null)!==(get("estimate_id")??null)||String(existing.title)!==String(get("title"))||String(existing.createdAt)!==String(get("created_at")))
      throw new Error(`Restore conflict: target task ${plan.identity} has different immutable relationship/title/created values.`);
  }
  if(plan.table==="expenses"&&targetExpenseById.has(plan.identity)){
    const existing=targetExpenseById.get(plan.identity);
    if((existing.estimateId??null)!==(get("estimate_id")??null)||String(existing.category)!==String(get("category"))||String(existing.description)!==String(get("description"))||Number(existing.amountCents)!==Number(get("amount_cents"))||String(existing.incurredAt)!==String(get("incurred_at")))
      throw new Error(`Restore conflict: target expense ${plan.identity} has different immutable job/category/amount/date values.`);
  }
  if(plan.table==="job_reports"&&targetJobReportById.has(plan.identity)){
    const existing=targetJobReportById.get(plan.identity);
    if(String(existing.estimateId)!==String(get("estimate_id"))||String(existing.customerId)!==String(get("customer_id"))||String(existing.checklist)!==String(get("checklist"))||String(existing.status)!==String(get("status")))
      throw new Error(`Restore conflict: target job report ${plan.identity} has different immutable job/customer/checklist/status values.`);
  }
  if(plan.table==="estimate_change_requests"&&targetChangeRequestById.has(plan.identity)){
    const existing=targetChangeRequestById.get(plan.identity);
    if(String(existing.estimateId)!==String(get("estimate_id"))||String(existing.customerId)!==String(get("customer_id"))||String(existing.message)!==String(get("message")))
      throw new Error(`Restore conflict: target change request ${plan.identity} has different immutable job/customer/message values.`);
  }
  if(plan.table==="payment_refunds"&&targetRefundById.has(plan.identity)){
    const existing=targetRefundById.get(plan.identity);
    const get=(name)=>plan.values[plan.columns.indexOf(name)];
    if(String(existing.paymentId)!==String(get("payment_id"))||String(existing.estimateId)!==String(get("estimate_id"))||Number(existing.amountCents)!==Number(get("amount_cents"))||String(existing.mode)!==String(get("mode")))
      throw new Error(`Restore conflict: target refund ${plan.identity} has different immutable payment/estimate/amount/mode values.`);
  }
  if(plan.table==="payments"&&targetPaymentById.has(plan.identity)){
    const existing=targetPaymentById.get(plan.identity);
    const get=(name)=>plan.values[plan.columns.indexOf(name)];
    const backupProvider=get("provider_id")==null?"":String(get("provider_id"));
    const existingProvider=existing.providerId==null?"":String(existing.providerId);
    if(String(existing.estimateId)!==String(get("estimate_id"))||Number(existing.amountCents)!==Number(get("amount_cents"))||existingProvider!==backupProvider)
      throw new Error(`Restore conflict: target payment ${plan.identity} has different immutable estimate/amount/provider values.`);
  }
}

const missing = plans.filter((plan) => !existingByTable.get(plan.table).has(plan.identity));

const targetRefundProviderResult = run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,provider_refund_id AS providerRefundId FROM payment_refunds WHERE provider_refund_id IS NOT NULL"]);
if(targetRefundProviderResult.status!==0)fail(targetRefundProviderResult,"Could not inspect target refund-provider IDs.");
const targetRefundProviderRows=JSON.parse(targetRefundProviderResult.stdout)[0]?.results||[];
const targetRefundProviderToId=new Map(targetRefundProviderRows.map((row)=>[String(row.providerRefundId),String(row.id)]));

const targetPaymentProviderResult = run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
  "SELECT id,provider_id AS providerId FROM payments WHERE provider_id LIKE 'cs_%' OR provider_id LIKE 'refund:%'"]);
if(targetPaymentProviderResult.status!==0)fail(targetPaymentProviderResult,"Could not inspect target payment-provider IDs.");
const targetPaymentProviderRows=JSON.parse(targetPaymentProviderResult.stdout)[0]?.results||[];
const targetPaymentProviderToId=new Map(targetPaymentProviderRows.map((row)=>[String(row.providerId),String(row.id)]));

for(const plan of missing){
  if(plan.table==="estimates"){
    const shareIndex=plan.columns.indexOf("share_token");
    const share=shareIndex>=0&&plan.values[shareIndex]!=null?String(plan.values[shareIndex]):"";
    const existingId=share?targetEstimateShareToId.get(share):undefined;
    if(existingId&&existingId!==plan.identity)throw new Error(`Restore conflict: estimate share token already belongs to target estimate ${existingId}, not backup estimate ${plan.identity}.`);
  }
  if(plan.table==="invoices"){
    const estimateId=String(plan.values[plan.columns.indexOf("estimate_id")]);
    const existingInvoiceId=targetInvoiceEstimateToId.get(estimateId);
    if(existingInvoiceId&&existingInvoiceId!==plan.identity)throw new Error(`Restore conflict: estimate ${estimateId} already has target invoice ${existingInvoiceId}, not backup invoice ${plan.identity}.`);
    const shareIndex=plan.columns.indexOf("share_token");
    const share=shareIndex>=0&&plan.values[shareIndex]!=null?String(plan.values[shareIndex]):"";
    const existingShareId=share?targetInvoiceShareToId.get(share):undefined;
    if(existingShareId&&existingShareId!==plan.identity)throw new Error(`Restore conflict: invoice share token already belongs to target invoice ${existingShareId}, not backup invoice ${plan.identity}.`);
  }
  if(plan.table==="payment_refunds"){
    const providerIndex=plan.columns.indexOf("provider_refund_id");
    const provider=providerIndex>=0&&plan.values[providerIndex]!=null?String(plan.values[providerIndex]):"";
    const existingId=provider?targetRefundProviderToId.get(provider):undefined;
    if(existingId&&existingId!==plan.identity)throw new Error(`Restore conflict: provider refund ${provider} already belongs to target refund ${existingId}, not backup refund ${plan.identity}.`);
  }
  if(plan.table==="payments"){
    const providerIndex=plan.columns.indexOf("provider_id");
    const provider=providerIndex>=0&&plan.values[providerIndex]!=null?String(plan.values[providerIndex]):"";
    const strongProvider=provider.startsWith("cs_")||provider.startsWith("refund:");
    const existingId=strongProvider?targetPaymentProviderToId.get(provider):undefined;
    if(existingId&&existingId!==plan.identity)throw new Error(`Restore conflict: payment provider ${provider} already belongs to target payment ${existingId}, not backup payment ${plan.identity}.`);
  }
}

const byTable = Object.fromEntries(TABLES.map(([table]) => {
  const restore = missing.filter((plan) => plan.table === table).length;
  return [table, { restore, preserve: plans.filter((plan) => plan.table === table).length - restore }];
}));
console.log(JSON.stringify({ backup: basename(absoluteBackup), targetDatabase: database.database_name, mode: local ? "local" : "remote", apply, summary: { restore: missing.length, preserve: plans.length - missing.length, legacyLifecycleNotificationsSkipped:lifecycleNormalization.skipped }, byTable, restoreAudit }, null, 2));
if (!apply) {
  restoreAudit.phase="complete";
  console.log(JSON.stringify({message:"Dry run complete. No database records were changed.",restoreAudit},null,2));
  process.exit(0);
}
if (!missing.length) {
  restoreAudit.phase="invariant_verification";
  const lifecycleVerify=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
    "SELECT type,estimate_id AS estimateId,COUNT(*) AS count FROM notifications WHERE estimate_id IS NOT NULL AND type IN ('estimate_viewed','invoice_viewed','estimate_accepted') GROUP BY type,estimate_id HAVING COUNT(*)>1 LIMIT 1"]);
  if(lifecycleVerify.status!==0)fail(lifecycleVerify,"Could not verify lifecycle notification uniqueness for no-op restore.");
  const lifecycleParsed=JSON.parse(lifecycleVerify.stdout);
  const lifecycleDuplicate=lifecycleParsed[0]?.results?.[0];
  if(lifecycleDuplicate)throw new Error(`Restore verification failed: duplicate lifecycle notification remains for ${lifecycleDuplicate.type}/${lifecycleDuplicate.estimateId}.`);
  restoreAudit.lifecycleNotificationUniquenessVerified=true;
  restoreAudit.phase="complete";
  console.log(JSON.stringify({message:"Nothing to restore. All backup records already exist and were preserved.",restoreAudit},null,2));
  process.exit(0);
}

const work = await mkdtemp(`${tmpdir()}/fire-records-restore-`);
try {
  const sqlPath = resolve(work, "restore.sql");
  const statements = missing.map(({ table, columns, values }) => `INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES (${values.map(sql).join(",")});`);
  await writeFile(sqlPath, `${statements.join("\n")}\n`, "utf8");
  restoreAudit.phase="write_apply";
  restoreAudit.writesAttempted=missing.length>0;
  restoreAudit.insertedRecordsExpected=missing.length;
  const result = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--yes", "--file", sqlPath]);
  if (result.status !== 0) fail(result, "The records restore did not complete. It is safe to inspect and retry because all writes are merge-only.");

  restoreAudit.phase="record_verification";
  let verified = 0;
  const normalize = (value) => value === null || value === undefined ? null : typeof value === "number" ? value : String(value);
  for (const [table] of TABLES) {
    const expected = missing.filter((plan) => plan.table === table);
    if (!expected.length) continue;
    for (const plan of expected) {
      const select = plan.columns.map((column) => `${column} AS "${column}"`).join(",");
      const verify = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--json", "--command", `SELECT ${select} FROM ${table} WHERE ${plan.identityColumn}=${sql(plan.identity)} LIMIT 1`]);
      if (verify.status !== 0) fail(verify, `Could not verify restored ${table} record ${plan.identity}.`);
      const parsed = JSON.parse(verify.stdout);
      const row = parsed[0]?.results?.[0];
      if (!row) throw new Error(`Restore verification failed: ${table} record ${plan.identity} is missing after apply.`);
      for (let index = 0; index < plan.columns.length; index += 1) {
        const column = plan.columns[index];
        const expectedValue = normalize(plan.values[index]);
        const actualValue = normalize(row[column]);
        if (actualValue !== expectedValue) throw new Error(`Restore verification failed: ${table}.${column} for ${plan.identity} expected ${JSON.stringify(expectedValue)} but found ${JSON.stringify(actualValue)}.`);
      }
      verified += 1;
      restoreAudit.verifiedRecords=verified;
    }
  }
  if (verified !== missing.length) throw new Error(`Restore verification failed: expected ${missing.length} records but verified ${verified}.`);

  restoreAudit.phase="invariant_verification";
  const lifecycleVerify=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",
    "SELECT type,estimate_id AS estimateId,COUNT(*) AS count FROM notifications WHERE estimate_id IS NOT NULL AND type IN ('estimate_viewed','invoice_viewed','estimate_accepted') GROUP BY type,estimate_id HAVING COUNT(*)>1 LIMIT 1"]);
  if(lifecycleVerify.status!==0)fail(lifecycleVerify,"Could not verify lifecycle notification uniqueness after restore.");
  const lifecycleParsed=JSON.parse(lifecycleVerify.stdout);
  const lifecycleDuplicate=lifecycleParsed[0]?.results?.[0];
  if(lifecycleDuplicate)throw new Error(`Restore verification failed: duplicate lifecycle notification remains for ${lifecycleDuplicate.type}/${lifecycleDuplicate.estimateId}.`);

  restoreAudit.lifecycleNotificationUniquenessVerified=true;
  restoreAudit.phase="complete";
  console.log(JSON.stringify({
    restoredAndVerified: verified,
    fieldValuesVerified: true,
    lifecycleNotificationUniquenessVerified: true,
    existingRecordsPreserved: plans.length - missing.length,
    legacyLifecycleNotificationsSkipped:lifecycleNormalization.skipped,
    restoreAudit
  }, null, 2));
 } catch(error) {
  const detail=error instanceof Error?error.message:String(error);
  const retryGuidance=restoreAudit.writesAttempted
    ? "Database writes may have occurred. Inspect this restore audit before retrying."
    : "No restore writes were attempted. Correct the error and retry.";
  console.error(JSON.stringify({error:detail,retryGuidance,restoreAudit},null,2));
  process.exitCode=1;
} finally {
  await rm(work, { recursive: true, force: true });
}
