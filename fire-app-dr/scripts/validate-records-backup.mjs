import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const pathArg = process.argv[2];
if (!pathArg) {
  console.error("Usage: node scripts/validate-records-backup.mjs <backup.json>");
  process.exit(1);
}
const path = resolve(pathArg);
const info = await stat(path).catch(() => null);
if (!info?.isFile()) throw new Error(`Backup not found: ${path}`);
if (info.size > 5_000_000) throw new Error("Backup is larger than the 5 MB restore limit.");
const payload = JSON.parse(await readFile(path, "utf8"));
let kind = null;
let tables = null;
if (payload?.format === "fire-app-records-backup" && payload?.version === 1 && payload.tables && typeof payload.tables === "object") {
  kind = "app-export";
  tables = payload.tables;
} else if (payload?.backup_format === "FIRE App live database snapshot" && payload?.format_version === 1 && payload.tables && typeof payload.tables === "object" && payload?.verification?.all_tables_complete === true && payload?.verification?.truncated === false) {
  kind = "verified-live-snapshot";
  tables = Object.fromEntries(Object.entries(payload.tables).map(([name, value]) => {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) throw new Error(`Snapshot table ${name} is invalid.`);
    return [name, value.rows];
  }));
} else {
  throw new Error("This is not a valid or complete FIRE App records backup.");
}
const required = ["customers","estimates","customer_notes","invoices","estimate_items","payments","customer_messages","notifications","message_templates","estimate_change_requests","tasks","expenses","job_reports"];
const optionalRecoveryTables = ["invoice_items", "invoice_revisions", "payment_checkout_sessions", "payment_refunds"];
for (const table of required) if (!Array.isArray(tables[table])) throw new Error(`Backup is missing ${table}.`);
for (const table of optionalRecoveryTables) if (tables[table] !== undefined && !Array.isArray(tables[table])) throw new Error(`Backup ${table} must be an array when present.`);
const criticalFields = {
  estimates:["id","customer_id","status","total_cents","deposit_cents","appreciation_discount","additional_discount_type","additional_discount_value"],
  notifications:["id","type","resolved_at","resolution_note"],
  invoices:["id","estimate_id","total_cents","status"],
  invoice_revisions:["id","invoice_id","total_cents","items_json"],
  payment_checkout_sessions:["id","estimate_id","type","amount_cents","status"],
  payment_refunds:["id","payment_id","estimate_id","amount_cents","mode","status"],
};
if(kind==="app-export"){
  for(const [table,fields] of Object.entries(criticalFields)){
    const rows=tables[table];
    if(!Array.isArray(rows)){
      if(optionalRecoveryTables.includes(table)&&rows===undefined)continue;
      throw new Error(`Current app backup is missing ${table}.`);
    }
    for(const [index,row] of rows.entries()){
      if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup ${table}[${index}] is invalid.`);
      for(const field of fields)if(!(field in row))throw new Error(`Backup ${table}[${index}] is missing critical field ${field}.`);
    }
  }
}


if (Array.isArray(tables.payment_refunds)) {
  const payments = Array.isArray(tables.payments) ? tables.payments : [];
  const estimates = Array.isArray(tables.estimates) ? tables.estimates : [];
  const paymentById = new Map(payments.map((row) => [String(row.id), row]));
  const estimateIds = new Set(estimates.map((row) => String(row.id)));
  const refundIds = new Set();
  const providerRefundIds = new Set();
  const refundLedgerProviders = new Set();
  const reservedByPayment = new Map();

  for (const [index, row] of tables.payment_refunds.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Backup payment_refunds[${index}] is invalid.`);
    const id = String(row.id ?? "");
    const paymentId = String(row.payment_id ?? "");
    const estimateId = String(row.estimate_id ?? "");
    const amount = Number(row.amount_cents);
    const mode = String(row.mode ?? "");
    const status = String(row.status ?? "");
    const providerRefundId = row.provider_refund_id == null ? "" : String(row.provider_refund_id);

    if (!id || refundIds.has(id)) throw new Error(`Backup payment_refunds contains a duplicate or blank id at row ${index}.`);
    refundIds.add(id);
    const originalPayment=paymentById.get(paymentId);
    if (!originalPayment) throw new Error(`Backup refund ${id} references missing payment ${paymentId}.`);
    if (!estimateIds.has(estimateId)) throw new Error(`Backup refund ${id} references missing estimate ${estimateId}.`);
    if (String(originalPayment.estimate_id ?? "") !== estimateId) throw new Error(`Backup refund ${id} payment/estimate relationship is inconsistent.`);
    const originalAmount=Number(originalPayment.amount_cents);
    if (!Number.isSafeInteger(originalAmount) || originalAmount<=0 || String(originalPayment.status)!=="paid") throw new Error(`Backup refund ${id} does not reference a valid positive paid payment.`);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Backup refund ${id} has an invalid amount.`);
    if (!["stripe","manual"].includes(mode)) throw new Error(`Backup refund ${id} has invalid mode ${mode}.`);
    if (!["pending","succeeded","failed"].includes(status)) throw new Error(`Backup refund ${id} has invalid status ${status}.`);
    if (providerRefundId) {
      if (providerRefundIds.has(providerRefundId)) throw new Error(`Backup contains duplicate provider refund id ${providerRefundId}.`);
      providerRefundIds.add(providerRefundId);
    }
    if (status === "pending" || status === "succeeded") {
      const nextReserved=(reservedByPayment.get(paymentId)??0)+amount;
      if (!Number.isSafeInteger(nextReserved) || nextReserved>originalAmount) throw new Error(`Backup refund reservations exceed original payment ${paymentId}.`);
      reservedByPayment.set(paymentId,nextReserved);
    }
    if (status === "succeeded") {
      const expectedProvider = `refund:${paymentId}:${id}`;
      const ledgerRows = payments.filter((payment) => String(payment.provider_id ?? "") === expectedProvider);
      if (ledgerRows.length !== 1) throw new Error(`Backup succeeded refund ${id} must have exactly one matching negative ledger row.`);
      if (Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status) !== "paid") throw new Error(`Backup succeeded refund ${id} has a mismatched ledger amount or status.`);
      refundLedgerProviders.add(expectedProvider);
    }
  }

  const duplicateRefundProviders = new Set();
  for (const payment of payments) {
    const provider = String(payment.provider_id ?? "");
    if (!provider.startsWith("refund:")) continue;
    if (duplicateRefundProviders.has(provider)) throw new Error(`Backup contains duplicate refund payment provider ${provider}.`);
    duplicateRefundProviders.add(provider);
    if (!refundLedgerProviders.has(provider)) throw new Error(`Backup contains orphan refund ledger row ${provider}.`);
  }
}


if (Array.isArray(tables.estimates)) {
  const estimateIds=new Set();
  const estimateShares=new Set();
  for (const [index,row] of tables.estimates.entries()) {
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup estimates[${index}] is invalid.`);
    const id=String(row.id??"");
    const share=row.share_token==null?"":String(row.share_token);
    if(!id||estimateIds.has(id))throw new Error(`Backup estimates contains duplicate or blank id ${id}.`);
    estimateIds.add(id);
    if(share){
      if(estimateShares.has(share))throw new Error(`Backup estimates contains duplicate share token ${share}.`);
      estimateShares.add(share);
    }
  }
}
if (Array.isArray(tables.invoices)) {
  const invoiceIds=new Set();
  const invoiceEstimateIds=new Set();
  const invoiceShares=new Set();
  for (const [index,row] of tables.invoices.entries()) {
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup invoices[${index}] is invalid.`);
    const id=String(row.id??"");
    const estimateId=String(row.estimate_id??"");
    const share=row.share_token==null?"":String(row.share_token);
    if(!id||invoiceIds.has(id))throw new Error(`Backup invoices contains duplicate or blank id ${id}.`);
    invoiceIds.add(id);
    if(!estimateId||invoiceEstimateIds.has(estimateId))throw new Error(`Backup contains more than one invoice for estimate ${estimateId}.`);
    invoiceEstimateIds.add(estimateId);
    if(share){
      if(invoiceShares.has(share))throw new Error(`Backup invoices contains duplicate share token ${share}.`);
      invoiceShares.add(share);
    }
  }
}


const customerIds=new Set((Array.isArray(tables.customers)?tables.customers:[]).map((row)=>String(row?.id??"")));
const estimateIdsGlobal=new Set((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>String(row?.id??"")));
const invoiceIdsGlobal=new Set((Array.isArray(tables.invoices)?tables.invoices:[]).map((row)=>String(row?.id??"")));

const ensureUniqueAndParent=(tableName,rows,parentChecks=[])=>{
  if(!Array.isArray(rows))return;
  const ids=new Set();
  rows.forEach((row,index)=>{
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup ${tableName}[${index}] is invalid.`);
    const id=String(row.id??"");
    if(!id||ids.has(id))throw new Error(`Backup ${tableName} contains duplicate or blank id ${id}.`);
    ids.add(id);
    for(const [field,set,label,optional] of parentChecks){
      const raw=row[field];
      if((raw===null||raw===undefined||raw==="")&&optional)continue;
      const value=String(raw??"");
      if(!value||!set.has(value))throw new Error(`Backup ${tableName} ${id} references missing ${label} ${value}.`);
    }
  });
};

ensureUniqueAndParent("estimate_items",tables.estimate_items,[["estimate_id",estimateIdsGlobal,"estimate",false]]);
ensureUniqueAndParent("invoice_items",tables.invoice_items,[["invoice_id",invoiceIdsGlobal,"invoice",false]]);
ensureUniqueAndParent("invoice_revisions",tables.invoice_revisions,[["invoice_id",invoiceIdsGlobal,"invoice",false]]);
ensureUniqueAndParent("payment_checkout_sessions",tables.payment_checkout_sessions,[["estimate_id",estimateIdsGlobal,"estimate",false]]);
ensureUniqueAndParent("customer_notes",tables.customer_notes,[["customer_id",customerIds,"customer",false]]);
ensureUniqueAndParent("customer_messages",tables.customer_messages,[["customer_id",customerIds,"customer",false],["estimate_id",estimateIdsGlobal,"estimate",true]]);
ensureUniqueAndParent("estimate_change_requests",tables.estimate_change_requests,[["estimate_id",estimateIdsGlobal,"estimate",false],["customer_id",customerIds,"customer",false]]);
ensureUniqueAndParent("tasks",tables.tasks,[["customer_id",customerIds,"customer",true],["estimate_id",estimateIdsGlobal,"estimate",true]]);
ensureUniqueAndParent("expenses",tables.expenses,[["estimate_id",estimateIdsGlobal,"estimate",true]]);
ensureUniqueAndParent("job_reports",tables.job_reports,[["estimate_id",estimateIdsGlobal,"estimate",false],["customer_id",customerIds,"customer",false]]);

if(Array.isArray(tables.job_reports)){
  const estimateCustomer=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>[String(row.id),String(row.customer_id)]));
  for(const row of tables.job_reports){
    if(String(estimateCustomer.get(String(row.estimate_id))??"")!==String(row.customer_id??""))
      throw new Error(`Backup job report ${row.id} customer does not match its estimate.`);
  }
}
if(Array.isArray(tables.estimate_change_requests)){
  const estimateCustomer=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>[String(row.id),String(row.customer_id)]));
  for(const row of tables.estimate_change_requests){
    if(String(estimateCustomer.get(String(row.estimate_id))??"")!==String(row.customer_id??""))
      throw new Error(`Backup change request ${row.id} customer does not match its estimate.`);
  }
}


ensureUniqueAndParent("customers",tables.customers,[]);
ensureUniqueAndParent("notifications",tables.notifications,[["customer_id",customerIds,"customer",true],["estimate_id",estimateIdsGlobal,"estimate",true]]);
ensureUniqueAndParent("message_templates",tables.message_templates,[]);

const lifecycleNotificationTypes=new Set(["estimate_viewed","invoice_viewed","estimate_accepted"]);
let legacyLifecycleNotificationDuplicates=0;
if(Array.isArray(tables.notifications)){
  const seenLifecycle=new Set();
  for(const row of tables.notifications){
    const type=String(row?.type??"");
    const estimateId=row?.estimate_id==null?"":String(row.estimate_id);
    if(!estimateId||!lifecycleNotificationTypes.has(type))continue;
    const key=`${type}\u0000${estimateId}`;
    if(seenLifecycle.has(key))legacyLifecycleNotificationDuplicates++;
    else seenLifecycle.add(key);
  }
}

if(Array.isArray(tables.customer_messages)){
  const estimateCustomer=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>[String(row.id),String(row.customer_id)]));
  for(const row of tables.customer_messages){
    if(row.estimate_id!=null&&row.estimate_id!==""&&String(estimateCustomer.get(String(row.estimate_id))??"")!==String(row.customer_id??""))
      throw new Error(`Backup customer message ${row.id} customer does not match its estimate.`);
  }
}
if(Array.isArray(tables.notifications)){
  const estimateCustomer=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>[String(row.id),String(row.customer_id)]));
  for(const row of tables.notifications){
    if(row.estimate_id!=null&&row.estimate_id!==""&&row.customer_id!=null&&row.customer_id!==""&&String(estimateCustomer.get(String(row.estimate_id))??"")!==String(row.customer_id??""))
      throw new Error(`Backup notification ${row.id} customer does not match its estimate.`);
  }
}
if(Array.isArray(tables.tasks)){
  const estimateCustomer=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map((row)=>[String(row.id),String(row.customer_id)]));
  for(const row of tables.tasks){
    if(row.estimate_id!=null&&row.estimate_id!==""&&row.customer_id!=null&&row.customer_id!==""&&String(estimateCustomer.get(String(row.estimate_id))??"")!==String(row.customer_id??""))
      throw new Error(`Backup task ${row.id} customer does not match its estimate.`);
  }
}


if(Array.isArray(tables.customer_photos)){
  const photoIds=new Set();
  const objectKeys=new Set();
  for(const [index,row] of tables.customer_photos.entries()){
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Backup customer_photos[${index}] is invalid.`);
    const id=String(row.id??"");
    const customerId=String(row.customer_id??"");
    const objectKey=String(row.object_key??"");
    const contentType=String(row.content_type??"");
    const category=String(row.category??"");
    const sizeBytes=Number(row.size_bytes);
    if(!id||photoIds.has(id))throw new Error(`Backup customer_photos contains duplicate or blank id ${id}.`);
    photoIds.add(id);
    if(!customerIds.has(customerId))throw new Error(`Backup photo ${id} references missing customer ${customerId}.`);
    if(!objectKey.startsWith(`customers/${customerId}/${id}.`)||objectKey.includes(".."))throw new Error(`Backup photo ${id} has an unsafe or mismatched object key.`);
    if(objectKeys.has(objectKey))throw new Error(`Backup customer_photos contains duplicate object key ${objectKey}.`);
    objectKeys.add(objectKey);
    if(!contentType.startsWith("image/"))throw new Error(`Backup photo ${id} has invalid content type.`);
    if(!["before","after","property"].includes(category))throw new Error(`Backup photo ${id} has invalid category.`);
    if(!Number.isSafeInteger(sizeBytes)||sizeBytes<0||sizeBytes>20*1024*1024)throw new Error(`Backup photo ${id} has invalid size.`);
  }
}

const counts = Object.fromEntries(Object.entries(tables).filter(([, rows]) => Array.isArray(rows)).map(([name, rows]) => [name, rows.length]));
console.log(JSON.stringify({file: basename(path), valid: true, kind, rows: Object.values(counts).reduce((a,b)=>a+b,0), counts, compatibility:{legacyLifecycleNotificationDuplicates,restoreBehavior:"earliest created_at lifecycle notification is preserved per type/estimate; later duplicates are skipped"}}, null, 2));
