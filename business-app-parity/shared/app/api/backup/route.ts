import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const TABLES = [
  "customers",
  "estimates",
  "customer_notes",
  "invoices",
  "invoice_items",
  "invoice_revisions",
  "payment_checkout_sessions",
  "payment_refunds",
  "estimate_items",
  "payments",
  "customer_photos",
  "customer_messages",
  "notifications",
  "message_templates",
  "estimate_change_requests",
  "tasks",
  "expenses",
  "job_reports",
] as const;

const RESTORE_TABLES = [
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
] as const;

type BackupRow = Record<string, string | number | null>;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const LIFECYCLE_NOTIFICATION_TYPES=new Set(["estimate_viewed","invoice_viewed","estimate_accepted"]);
function normalizeLegacyLifecycleNotifications(rows: unknown){
  if(!Array.isArray(rows))return {rows,skipped:0};
  const passthrough=[];
  const winnerByKey=new Map<string, Record<string, unknown>>();
  let skipped=0;
  const rank=(row: Record<string, unknown>): [number, string]=>{
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

function normalizeBackupTables(payload: Record<string, unknown>) {
  if (payload.format === "fire-app-records-backup" && payload.version === 1 && isRecord(payload.tables)) {
    return payload.tables;
  }
  if (payload.backup_format === "FIRE App live database snapshot" && payload.format_version === 1 && isRecord(payload.tables)) {
    const verification = isRecord(payload.verification) ? payload.verification : null;
    if (!verification || verification.all_tables_complete !== true || verification.truncated !== false) return null;
    const normalized: Record<string, unknown> = {};
    for (const [table, value] of Object.entries(payload.tables)) {
      if (!isRecord(value) || !Array.isArray(value.rows)) return null;
      normalized[table] = value.rows;
    }
    return normalized;
  }
  return null;
}


function validateBackupRelationships(tables: Record<string, unknown>) {
  const rows=(table:string)=>Array.isArray(tables[table])?(tables[table] as unknown[]).filter(isRecord):[];
  const ids=(table:string)=>new Set(rows(table).map(row=>String(row.id??"")));
  const customers=ids("customers"),estimates=ids("estimates"),invoices=ids("invoices");
  const estimateOwners=new Map(rows("estimates").map(row=>[String(row.id),String(row.customer_id)]));
  const checks:[string,string,Set<string>,boolean][]=[
    ["estimates","customer_id",customers,false],["invoices","customer_id",customers,false],
    ["invoices","estimate_id",estimates,false],["estimate_items","estimate_id",estimates,false],
    ["invoice_items","invoice_id",invoices,false],["invoice_revisions","invoice_id",invoices,false],
    ["payments","estimate_id",estimates,false],["payment_checkout_sessions","estimate_id",estimates,false],
    ["customer_notes","customer_id",customers,false],["customer_messages","customer_id",customers,false],
    ["customer_messages","estimate_id",estimates,true],["customer_photos","customer_id",customers,false],
    ["customer_photos","estimate_id",estimates,true],["job_reports","customer_id",customers,false],
    ["job_reports","estimate_id",estimates,false],["estimate_change_requests","customer_id",customers,false],
    ["estimate_change_requests","estimate_id",estimates,false],["notifications","customer_id",customers,true],
    ["notifications","estimate_id",estimates,true],["tasks","customer_id",customers,true],
    ["tasks","estimate_id",estimates,true],["expenses","estimate_id",estimates,true],
  ];
  for(const [table,column,known,optional] of checks)for(const row of rows(table)){
    if(optional&&row[column]==null)continue;
    if(!known.has(String(row[column]??"")))return `${table} ${row.id} references missing ${column}.`;
  }
  for(const table of ["invoices","job_reports","estimate_change_requests","customer_photos","customer_messages"])
    for(const row of rows(table))if(row.estimate_id!=null&&estimateOwners.get(String(row.estimate_id))!==String(row.customer_id))return `${table} ${row.id} has inconsistent customer/estimate ownership.`;
  const providers=new Set<string>();
  for(const row of rows("payments")){
    const provider=String(row.provider_id??"");
    if(!provider.startsWith("cs_")&&!provider.startsWith("refund:"))continue;
    if(providers.has(provider))return `Duplicate Stripe payment provider ${provider}.`;
    providers.add(provider);
  }
  return null;
}

function validateRefundIntegrity(tables: Record<string, unknown>) {
  const refundRows = tables.payment_refunds;
  if (refundRows === undefined) return null;
  if (!Array.isArray(refundRows)) return "Backup payment_refunds must be an array.";
  const payments = Array.isArray(tables.payments) ? tables.payments.filter(isRecord) : [];
  const estimates = Array.isArray(tables.estimates) ? tables.estimates.filter(isRecord) : [];
  const paymentById = new Map(payments.map((row) => [String(row.id ?? ""), row]));
  const estimateIds = new Set(estimates.map((row) => String(row.id ?? "")));
  const refundIds = new Set<string>();
  const providerRefundIds = new Set<string>();
  const refundPaymentProviders = new Set<string>();
  const succeededRefundProviders = new Set<string>();
  const reservedByPayment = new Map<string,number>();

  for (const [index, raw] of refundRows.entries()) {
    if (!isRecord(raw)) return `Backup payment_refunds[${index}] is invalid.`;
    const id = String(raw.id ?? "");
    const paymentId = String(raw.payment_id ?? "");
    const estimateId = String(raw.estimate_id ?? "");
    const amount = Number(raw.amount_cents);
    const mode = String(raw.mode ?? "");
    const status = String(raw.status ?? "");
    const providerRefundId = raw.provider_refund_id == null ? "" : String(raw.provider_refund_id);

    if (!id || refundIds.has(id)) return `Backup contains a duplicate or blank refund request ID at row ${index}.`;
    refundIds.add(id);
    const payment = paymentById.get(paymentId);
    if (!payment) return `Refund ${id} references missing payment ${paymentId}.`;
    if (!estimateIds.has(estimateId)) return `Refund ${id} references missing estimate ${estimateId}.`;
    if (String(payment.estimate_id ?? "") !== estimateId) return `Refund ${id} has inconsistent payment/estimate ownership.`;
    const originalAmount=Number(payment.amount_cents);
    if (!Number.isSafeInteger(originalAmount) || originalAmount<=0 || String(payment.status ?? "")!=="paid") return `Refund ${id} does not reference a valid positive paid payment.`;
    if (!Number.isSafeInteger(amount) || amount <= 0) return `Refund ${id} has an invalid amount.`;
    if (!["stripe","manual"].includes(mode)) return `Refund ${id} has invalid mode.`;
    if (!["pending","succeeded","failed"].includes(status)) return `Refund ${id} has invalid status.`;
    if (providerRefundId) {
      if (providerRefundIds.has(providerRefundId)) return `Duplicate provider refund ID ${providerRefundId}.`;
      providerRefundIds.add(providerRefundId);
    }
    if (status === "pending" || status === "succeeded") {
      const nextReserved=(reservedByPayment.get(paymentId)??0)+amount;
      if (!Number.isSafeInteger(nextReserved) || nextReserved>originalAmount) return `Refund reservations exceed original payment ${paymentId}.`;
      reservedByPayment.set(paymentId,nextReserved);
    }
    if (status === "succeeded") {
      const expectedProvider = `refund:${paymentId}:${id}`;
      const ledgerRows = payments.filter((row) => String(row.provider_id ?? "") === expectedProvider);
      if (ledgerRows.length !== 1) return `Succeeded refund ${id} must have exactly one matching negative payment ledger row.`;
      const expectedLedgerType=String(payment.type??"")==="Tip"?"Tip Refund":"Refund";
      if (String(ledgerRows[0].estimate_id??"")!==estimateId || Number(ledgerRows[0].amount_cents) !== -amount || String(ledgerRows[0].status ?? "") !== "paid" || String(ledgerRows[0].type ?? "") !== expectedLedgerType)
        return `Succeeded refund ${id} has a mismatched negative payment ledger row.`;
      succeededRefundProviders.add(expectedProvider);
    }
  }

  for (const payment of payments) {
    const provider = String(payment.provider_id ?? "");
    if (!provider.startsWith("refund:")) continue;
    if (refundPaymentProviders.has(provider)) return `Duplicate refund ledger provider ${provider}.`;
    refundPaymentProviders.add(provider);
    if (!succeededRefundProviders.has(provider)) return `Orphan refund ledger provider ${provider}.`;
  }
  return null;
}

async function authorized() {
  const user = await getChatGPTUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

export async function GET() {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await env.DB.batch(TABLES.map((table) => env.DB.prepare(`SELECT * FROM ${table}`)));
    const tables = Object.fromEntries(TABLES.map((table, index) => [table, results[index]?.results ?? []]));
    const refundIntegrityError=validateRefundIntegrity(tables);
    if(refundIntegrityError)return Response.json({error:`Records backup stopped: ${refundIntegrityError}`},{status:409});
    if(Array.isArray(tables.customer_photos)){
      const photoIds=new Set<string>();
      const objectKeys=new Set<string>();
      const customerIds=new Set((Array.isArray(tables.customers)?tables.customers:[]).filter(isRecord).map((row)=>String(row.id??"")));
      for(const raw of tables.customer_photos){
        if(!isRecord(raw))return Response.json({error:"Records backup stopped: invalid customer photo metadata."},{status:409});
        const id=String(raw.id??""); const customerId=String(raw.customer_id??""); const objectKey=String(raw.object_key??"");
        const contentType=String(raw.content_type??""); const category=String(raw.category??""); const sizeBytes=Number(raw.size_bytes);
        if(!id||photoIds.has(id))return Response.json({error:`Records backup stopped: duplicate/blank photo id ${id}.`},{status:409});
        photoIds.add(id);
        if(!customerIds.has(customerId))return Response.json({error:`Records backup stopped: photo ${id} references missing customer.`},{status:409});
        if(!objectKey.startsWith(`customers/${customerId}/${id}.`)||objectKey.includes(".."))return Response.json({error:`Records backup stopped: photo ${id} has unsafe object metadata.`},{status:409});
        if(objectKeys.has(objectKey))return Response.json({error:`Records backup stopped: duplicate photo object key.`},{status:409});
        objectKeys.add(objectKey);
        if(!contentType.startsWith("image/")||!["before","after","property"].includes(category)||!Number.isSafeInteger(sizeBytes)||sizeBytes<0||sizeBytes>20*1024*1024)
          return Response.json({error:`Records backup stopped: photo ${id} has invalid metadata.`},{status:409});
      }
    }
    const exportedAt = new Date().toISOString();
    const payload = {
      format: "fire-app-records-backup",
      version: 1,
      exportedAt,
      includes: {
        databaseRecords: true,
        photoMetadata: true,
        photoFiles: false,
        invoiceRevisionHistory: true,
        paymentCheckoutSessionSafety: true,
        paymentRefundHistory: true,
      },
      warning: "Customer photo files are stored separately and are not included in this JSON backup.",
      tables,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename=fire-app-records-backup-${exportedAt.slice(0, 10)}.json`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "The records backup could not be created. No records were changed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const restoreAudit={
    attemptId:crypto.randomUUID(),
    phase:"input_validation",
    writesAttempted:false,
    insertedRecords:0,
    verifiedRecords:0,
    lifecycleNotificationUniquenessVerified:false,
    relationshipIntegrityVerified:false,
    legacyLifecycleNotificationsSkipped:0,
  };
  const postWriteFailure=(error:string)=>Response.json({
    error,
    retryGuidance:"Database writes occurred. Inspect the restore audit before retrying.",
    restoreAudit,
  },{status:500});
  try {
    const raw = await request.text();
    if (raw.length > 5_000_000) return Response.json({ error: "That backup is larger than the 5 MB restore limit." }, { status: 413 });
    const payload: unknown = JSON.parse(raw);
    if (!isRecord(payload)) return Response.json({ error: "This is not a valid FIRE App records backup." }, { status: 400 });
    const backupTables = normalizeBackupTables(payload);
    if (!backupTables) return Response.json({ error: "This is not a valid or complete FIRE App records backup." }, { status: 400 });
    const relationshipError=validateBackupRelationships(backupTables);
    if(relationshipError)return Response.json({error:`This backup failed relationship validation: ${relationshipError}`,restoreAudit},{status:400});
    const lifecycleNormalization=normalizeLegacyLifecycleNotifications(backupTables.notifications);
    backupTables.notifications=lifecycleNormalization.rows;
    restoreAudit.legacyLifecycleNotificationsSkipped=lifecycleNormalization.skipped;
    restoreAudit.phase="target_conflict_validation";
    const refundIntegrityError=validateRefundIntegrity(backupTables);
    if(refundIntegrityError)return Response.json({error:`This backup failed refund-integrity validation: ${refundIntegrityError}`},{status:400});

    if(Array.isArray(backupTables.payments)) for(const row of backupTables.payments) {
      if(!isRecord(row))return Response.json({error:"Invalid payment record."},{status:400});
      const fee=row.processing_fee_cents, gross=row.gross_received_cents, tip=row.bundled_tip_cents;
      if(fee!=null&&(!Number.isSafeInteger(fee)||Number(fee)<0||gross==null||Number(fee)>Number(gross)))return Response.json({error:"Invalid processing fee in backup."},{status:400});
      if(gross!=null&&(!Number.isSafeInteger(gross)||Number(gross)<0||!Number.isSafeInteger(Number(tip??0))||Number(tip??0)<0||Number(gross)!==Number(row.amount_cents)+Number(tip??0)))return Response.json({error:"Invalid gross payment accounting in backup."},{status:400});
      if(row.processing_method!=null&&typeof row.processing_method!=="string")return Response.json({error:"Invalid processing method in backup."},{status:400});
    }
    const restoredAt = new Date().toISOString();

    const [targetRefundProviders,targetPaymentProviders,targetRefundIdentities,targetPaymentIdentities,targetEstimates,targetInvoices,targetCheckouts,targetRevisions,targetEstimateItems,targetInvoiceItems,targetTasks,targetExpenses,targetJobReports,targetChangeRequests,targetCustomers,targetCustomerNotes,targetCustomerMessages,targetNotifications,targetTemplates]=await Promise.all([
      env.DB.prepare("SELECT id,provider_refund_id AS providerRefundId FROM payment_refunds WHERE provider_refund_id IS NOT NULL").all<{id:string;providerRefundId:string}>(),
      env.DB.prepare("SELECT id,provider_id AS providerId FROM payments WHERE provider_id LIKE 'cs_%' OR provider_id LIKE 'refund:%'").all<{id:string;providerId:string}>(),
      env.DB.prepare("SELECT id,payment_id AS paymentId,estimate_id AS estimateId,amount_cents AS amountCents,mode FROM payment_refunds").all<{id:string;paymentId:string;estimateId:string;amountCents:number;mode:string}>(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents,status,provider_id AS providerId,processing_fee_cents,gross_received_cents,bundled_tip_cents,processing_method FROM payments").all<{id:string;estimateId:string;type:string;amountCents:number;status:string;providerId:string|null;processing_fee_cents:number|null;gross_received_cents:number|null;bundled_tip_cents:number|null;processing_method:string|null}>(),
      env.DB.prepare("SELECT id,customer_id AS customerId,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,deposit_cents AS depositCents,share_token AS shareToken FROM estimates").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,subtotal_cents AS subtotalCents,discount_cents AS discountCents,total_cents AS totalCents,share_token AS shareToken FROM invoices").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,type,amount_cents AS amountCents FROM payment_checkout_sessions").all(),
      env.DB.prepare("SELECT id,invoice_id AS invoiceId,total_cents AS totalCents,items_json AS itemsJson FROM invoice_revisions").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,name,quantity,unit,total_cents AS totalCents FROM estimate_items").all(),
      env.DB.prepare("SELECT id,invoice_id AS invoiceId,name,quantity,unit,total_cents AS totalCents FROM invoice_items").all(),
      env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,title,created_at AS createdAt FROM tasks").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,category,description,amount_cents AS amountCents,incurred_at AS incurredAt FROM expenses").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,status FROM job_reports").all(),
      env.DB.prepare("SELECT id,estimate_id AS estimateId,customer_id AS customerId,message FROM estimate_change_requests").all(),
      env.DB.prepare("SELECT id,name,email,phone,address,lead_source AS leadSource,created_at AS createdAt FROM customers").all(),
      env.DB.prepare("SELECT id,customer_id AS customerId,body,created_at AS createdAt FROM customer_notes").all(),
      env.DB.prepare("SELECT id,customer_id AS customerId,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages").all(),
      env.DB.prepare("SELECT id,type,title,body,customer_id AS customerId,estimate_id AS estimateId,created_at AS createdAt FROM notifications").all(),
      env.DB.prepare("SELECT key,subject,body,updated_at AS updatedAt FROM message_templates").all(),
    ]);
    const targetRefundProviderToId=new Map(targetRefundProviders.results.map((row)=>[String(row.providerRefundId),String(row.id)]));
    const targetPaymentProviderToId=new Map(targetPaymentProviders.results.map((row)=>[String(row.providerId),String(row.id)]));
    const targetRefundById=new Map(targetRefundIdentities.results.map((row)=>[String(row.id),row]));
    const targetPaymentById=new Map(targetPaymentIdentities.results.map((row)=>[String(row.id),row]));
    const targetEstimateById=new Map((targetEstimates.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetEstimateShareToId=new Map((targetEstimates.results as Record<string,unknown>[]).filter((row)=>row.shareToken).map((row)=>[String(row.shareToken),String(row.id)]));
    const targetInvoiceById=new Map((targetInvoices.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetInvoiceEstimateToId=new Map((targetInvoices.results as Record<string,unknown>[]).map((row)=>[String(row.estimateId),String(row.id)]));
    const targetInvoiceShareToId=new Map((targetInvoices.results as Record<string,unknown>[]).filter((row)=>row.shareToken).map((row)=>[String(row.shareToken),String(row.id)]));
    const targetCheckoutById=new Map((targetCheckouts.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetRevisionById=new Map((targetRevisions.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetEstimateItemById=new Map((targetEstimateItems.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetInvoiceItemById=new Map((targetInvoiceItems.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetTaskById=new Map((targetTasks.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetExpenseById=new Map((targetExpenses.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetJobReportById=new Map((targetJobReports.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetChangeRequestById=new Map((targetChangeRequests.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetCustomerById=new Map((targetCustomers.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetCustomerNoteById=new Map((targetCustomerNotes.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetCustomerMessageById=new Map((targetCustomerMessages.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetNotificationById=new Map((targetNotifications.results as Record<string,unknown>[]).map((row)=>[String(row.id),row]));
    const targetTemplateByKey=new Map((targetTemplates.results as Record<string,unknown>[]).map((row)=>[String(row.key),row]));

    if(Array.isArray(backupTables.estimates)){
      for(const raw of backupTables.estimates){
        if(!isRecord(raw))return Response.json({error:"The estimates backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const existing=targetEstimateById.get(id);
        if(existing&&(String(existing.customerId)!==String(raw.customer_id??"")||Number(existing.subtotalCents)!==Number(raw.subtotal_cents)||Number(existing.discountCents)!==Number(raw.discount_cents)||Number(existing.totalCents)!==Number(raw.total_cents)||Number(existing.depositCents)!==Number(raw.deposit_cents)||(existing.shareToken??null)!==(raw.share_token??null)))
          return Response.json({error:`Restore conflict: estimate ${id} already exists with different immutable financial values.`},{status:409});
        const share=raw.share_token==null?"":String(raw.share_token);
        const existingShareId=share?targetEstimateShareToId.get(share):undefined;
        if(existingShareId&&existingShareId!==id)return Response.json({error:`Restore conflict: estimate share token already belongs to another estimate.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.invoices)){
      for(const raw of backupTables.invoices){
        if(!isRecord(raw))return Response.json({error:"The invoices backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const existing=targetInvoiceById.get(id);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.customerId)!==String(raw.customer_id??"")||Number(existing.subtotalCents)!==Number(raw.subtotal_cents)||Number(existing.discountCents)!==Number(raw.discount_cents)||Number(existing.totalCents)!==Number(raw.total_cents)||(existing.shareToken??null)!==(raw.share_token??null)))
          return Response.json({error:`Restore conflict: invoice ${id} already exists with different immutable financial values.`},{status:409});
        const estimateId=String(raw.estimate_id??"");
        const existingInvoiceId=targetInvoiceEstimateToId.get(estimateId);
        if(existingInvoiceId&&existingInvoiceId!==id)return Response.json({error:`Restore conflict: estimate ${estimateId} already has a different invoice.`},{status:409});
        const share=raw.share_token==null?"":String(raw.share_token);
        const existingShareId=share?targetInvoiceShareToId.get(share):undefined;
        if(existingShareId&&existingShareId!==id)return Response.json({error:"Restore conflict: invoice share token already belongs to another invoice."},{status:409});
      }
    }
    if(Array.isArray(backupTables.payment_checkout_sessions)){
      for(const raw of backupTables.payment_checkout_sessions){
        if(!isRecord(raw))return Response.json({error:"The checkout-session backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const existing=targetCheckoutById.get(id);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.type)!==String(raw.type??"")||Number(existing.amountCents)!==Number(raw.amount_cents)))
          return Response.json({error:`Restore conflict: checkout ${id} already exists with different immutable financial values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.invoice_revisions)){
      for(const raw of backupTables.invoice_revisions){
        if(!isRecord(raw))return Response.json({error:"The invoice revision backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const existing=targetRevisionById.get(id);
        if(existing&&(String(existing.invoiceId)!==String(raw.invoice_id??"")||Number(existing.totalCents)!==Number(raw.total_cents)||String(existing.itemsJson)!==String(raw.items_json??"")))
          return Response.json({error:`Restore conflict: invoice revision ${id} already exists with different immutable financial values.`},{status:409});
      }
    }

    const same=(a:unknown,b:unknown)=>(a??null)===(b??null);
    if(Array.isArray(backupTables.customers)){
      for(const raw of backupTables.customers){
        if(!isRecord(raw))return Response.json({error:"The customers backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetCustomerById.get(id);
        if(existing&&(String(existing.name)!==String(raw.name??"")||!same(existing.email,raw.email)||!same(existing.phone,raw.phone)||!same(existing.address,raw.address)||String(existing.leadSource)!==String(raw.lead_source??"")||String(existing.createdAt)!==String(raw.created_at??"")))
          return Response.json({error:`Restore conflict: customer ${id} already exists with different immutable identity/contact values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.customer_notes)){
      for(const raw of backupTables.customer_notes){
        if(!isRecord(raw))return Response.json({error:"The customer_notes backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetCustomerNoteById.get(id);
        if(existing&&(String(existing.customerId)!==String(raw.customer_id??"")||String(existing.body)!==String(raw.body??"")||String(existing.createdAt)!==String(raw.created_at??"")))
          return Response.json({error:`Restore conflict: customer note ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.customer_messages)){
      for(const raw of backupTables.customer_messages){
        if(!isRecord(raw))return Response.json({error:"The customer_messages backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetCustomerMessageById.get(id);
        if(existing&&(String(existing.customerId)!==String(raw.customer_id??"")||!same(existing.estimateId,raw.estimate_id)||String(existing.channel)!==String(raw.channel??"")||String(existing.template)!==String(raw.template??"")||String(existing.body)!==String(raw.body??"")||String(existing.createdAt)!==String(raw.created_at??"")))
          return Response.json({error:`Restore conflict: customer message ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.notifications)){
      for(const raw of backupTables.notifications){
        if(!isRecord(raw))return Response.json({error:"The notifications backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetNotificationById.get(id);
        if(existing&&(String(existing.type)!==String(raw.type??"")||String(existing.title)!==String(raw.title??"")||String(existing.body)!==String(raw.body??"")||!same(existing.customerId,raw.customer_id)||!same(existing.estimateId,raw.estimate_id)||String(existing.createdAt)!==String(raw.created_at??"")))
          return Response.json({error:`Restore conflict: notification ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.message_templates)){
      for(const raw of backupTables.message_templates){
        if(!isRecord(raw))return Response.json({error:"The message_templates backup contains an invalid record."},{status:400});
        const key=String(raw.key??""); const existing=targetTemplateByKey.get(key);
        if(existing&&(String(existing.subject)!==String(raw.subject??"")||String(existing.body)!==String(raw.body??"")||String(existing.updatedAt)!==String(raw.updated_at??"")))
          return Response.json({error:`Restore conflict: message template ${key} already exists with different saved content/version values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.estimate_items)){
      for(const raw of backupTables.estimate_items){
        if(!isRecord(raw))return Response.json({error:"The estimate_items backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetEstimateItemById.get(id);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.name)!==String(raw.name??"")||Number(existing.quantity)!==Number(raw.quantity)||String(existing.unit)!==String(raw.unit??"")||Number(existing.totalCents)!==Number(raw.total_cents)))
          return Response.json({error:`Restore conflict: estimate item ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.invoice_items)){
      for(const raw of backupTables.invoice_items){
        if(!isRecord(raw))return Response.json({error:"The invoice_items backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetInvoiceItemById.get(id);
        if(existing&&(String(existing.invoiceId)!==String(raw.invoice_id??"")||String(existing.name)!==String(raw.name??"")||Number(existing.quantity)!==Number(raw.quantity)||String(existing.unit)!==String(raw.unit??"")||Number(existing.totalCents)!==Number(raw.total_cents)))
          return Response.json({error:`Restore conflict: invoice item ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.tasks)){
      for(const raw of backupTables.tasks){
        if(!isRecord(raw))return Response.json({error:"The tasks backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetTaskById.get(id);
        if(existing&&(!same(existing.customerId,raw.customer_id)||!same(existing.estimateId,raw.estimate_id)||String(existing.title)!==String(raw.title??"")||String(existing.createdAt)!==String(raw.created_at??"")))
          return Response.json({error:`Restore conflict: task ${id} already exists with different immutable relationship values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.expenses)){
      for(const raw of backupTables.expenses){
        if(!isRecord(raw))return Response.json({error:"The expenses backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetExpenseById.get(id);
        if(existing&&(!same(existing.estimateId,raw.estimate_id)||String(existing.category)!==String(raw.category??"")||String(existing.description)!==String(raw.description??"")||Number(existing.amountCents)!==Number(raw.amount_cents)||String(existing.incurredAt)!==String(raw.incurred_at??"")))
          return Response.json({error:`Restore conflict: expense ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.job_reports)){
      for(const raw of backupTables.job_reports){
        if(!isRecord(raw))return Response.json({error:"The job_reports backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetJobReportById.get(id);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.customerId)!==String(raw.customer_id??"")||String(existing.checklist)!==String(raw.checklist??"")||String(existing.status)!==String(raw.status??"")))
          return Response.json({error:`Restore conflict: job report ${id} already exists with different immutable values.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.estimate_change_requests)){
      for(const raw of backupTables.estimate_change_requests){
        if(!isRecord(raw))return Response.json({error:"The estimate_change_requests backup contains an invalid record."},{status:400});
        const id=String(raw.id??""); const existing=targetChangeRequestById.get(id);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.customerId)!==String(raw.customer_id??"")||String(existing.message)!==String(raw.message??"")))
          return Response.json({error:`Restore conflict: change request ${id} already exists with different immutable values.`},{status:409});
      }
    }

    if(Array.isArray(backupTables.payment_refunds)){
      for(const raw of backupTables.payment_refunds){
        if(!isRecord(raw))return Response.json({error:"The payment_refunds backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const existing=targetRefundById.get(id);
        if(existing&&(String(existing.paymentId)!==String(raw.payment_id??"")||String(existing.estimateId)!==String(raw.estimate_id??"")||Number(existing.amountCents)!==Number(raw.amount_cents)||String(existing.mode)!==String(raw.mode??"")))
          return Response.json({error:`Restore conflict: refund ${id} already exists with different immutable financial values.`},{status:409});
        const provider=raw.provider_refund_id==null?"":String(raw.provider_refund_id);
        const existingId=provider?targetRefundProviderToId.get(provider):undefined;
        if(existingId&&existingId!==id)return Response.json({error:`Restore conflict: provider refund ${provider} already belongs to another refund in this database.`},{status:409});
      }
    }
    if(Array.isArray(backupTables.payments)){
      for(const raw of backupTables.payments){
        if(!isRecord(raw))return Response.json({error:"The payments backup contains an invalid record."},{status:400});
        const id=String(raw.id??"");
        const provider=raw.provider_id==null?"":String(raw.provider_id);
        const existing=targetPaymentById.get(id);
        const existingProvider=existing?.providerId==null?"":String(existing.providerId);
        if(existing&&(String(existing.estimateId)!==String(raw.estimate_id??"")||String(existing.type)!==String(raw.type??"")||Number(existing.amountCents)!==Number(raw.amount_cents)||String(existing.status)!==String(raw.status??"")||existingProvider!==provider))
          return Response.json({error:`Restore conflict: payment ${id} already exists with different immutable financial values.`},{status:409});
        if(existing) for(const column of ["processing_fee_cents","gross_received_cents","bundled_tip_cents","processing_method"] as const) {
          if(raw[column]!==undefined && raw[column]!==existing[column])return Response.json({error:`Restore conflict: payment ${id} has different processing accounting.`},{status:409});
        }
        const strongProvider=provider.startsWith("cs_")||provider.startsWith("refund:");
        const existingId=strongProvider?targetPaymentProviderToId.get(provider):undefined;
        if(existingId&&existingId!==id)return Response.json({error:`Restore conflict: payment provider ${provider} already belongs to another payment in this database.`},{status:409});
      }
    }

    const statements: ReturnType<typeof env.DB.prepare>[] = [];
    const verificationPlans:{table:string;identityColumn:string;identity:string;columns:readonly string[];values:(string|number|null)[]}[]=[];
    for (const [table, columns] of RESTORE_TABLES) {
      const rows = backupTables[table];
      if (!Array.isArray(rows)) {
        if (table === "invoice_items" || table === "invoice_revisions" || table === "payment_checkout_sessions" || table === "payment_refunds") continue;
        return Response.json({ error: `The backup is missing the ${table} records.` }, { status: 400 });
      }
      for (const candidate of rows) {
        if (!isRecord(candidate)) return Response.json({ error: `The ${table} backup contains an invalid record.` }, { status: 400 });
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
        if (values.some((value) => value !== null && typeof value !== "string" && typeof value !== "number")) {
          return Response.json({ error: `The ${table} backup contains an invalid field.` }, { status: 400 });
        }
        const placeholders = columns.map(() => "?").join(",");
        const identityColumn=table==="message_templates"?"key":"id";
        const identity=String(candidate[identityColumn]??"");
        if(!identity)return Response.json({error:`The ${table} backup contains a record without a valid ${identityColumn}.`},{status:400});
        statements.push(env.DB.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`).bind(...values as BackupRow[keyof BackupRow][]));
        verificationPlans.push({table,identityColumn,identity,columns,values:values as (string|number|null)[]});
      }
    }
    if (!Array.isArray(backupTables.invoice_items)) {
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO invoice_items (id,invoice_id,name,description,quantity,unit,total_cents) SELECT lower(hex(randomblob(16))),inv.id,ei.name,ei.description,ei.quantity,ei.unit,ei.total_cents FROM invoices inv JOIN estimate_items ei ON ei.estimate_id=inv.estimate_id`));
      statements.push(env.DB.prepare(`UPDATE invoices SET subtotal_cents=COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id),total_cents),discount_cents=MAX(0,COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id),total_cents)-total_cents),discount_type='dollar',discount_value=MAX(0,COALESCE((SELECT SUM(ii.total_cents) FROM invoice_items ii WHERE ii.invoice_id=invoices.id),total_cents)-total_cents) WHERE subtotal_cents=0`));
    }
    if (statements.length > 5_000) return Response.json({ error: "This backup contains more than 5,000 records and requires a managed restore." }, { status: 413 });
    restoreAudit.phase="write_apply";
    restoreAudit.writesAttempted=statements.length>0;
    const results = statements.length ? await env.DB.batch(statements) : [];
    const recordResults=results.slice(0,verificationPlans.length);
    const insertedRecords=recordResults.reduce((sum,result)=>sum+Number(result.meta.changes??0),0);
    restoreAudit.insertedRecords=insertedRecords;
    restoreAudit.phase="record_verification";

    const normalize=(value:unknown)=>value===null||value===undefined?null:typeof value==="number"?value:String(value);
    let verifiedRecords=0;
    for(let planIndex=0;planIndex<verificationPlans.length;planIndex++){
      if(Number(recordResults[planIndex]?.meta.changes??0)===0)continue;
      const plan=verificationPlans[planIndex];
      const select=plan.columns.map((column)=>`${column} AS "${column}"`).join(",");
      const row=await env.DB.prepare(`SELECT ${select} FROM ${plan.table} WHERE ${plan.identityColumn}=? LIMIT 1`).bind(plan.identity).first<Record<string,unknown>>();
      if(!row)return postWriteFailure(`Restore verification failed: ${plan.table} record ${plan.identity} is missing after apply.`);
      for(let index=0;index<plan.columns.length;index++){
        const column=plan.columns[index];
        const expected=normalize(plan.values[index]);
        const actual=normalize(row[column]);
        if(actual!==expected)return postWriteFailure(`Restore verification failed: ${plan.table}.${column} for ${plan.identity} does not match the backup.`);
      }
      verifiedRecords++;
      restoreAudit.verifiedRecords=verifiedRecords;
    }
    if(verifiedRecords!==insertedRecords)return postWriteFailure(`Restore verification failed: expected ${insertedRecords} inserted records but verified ${verifiedRecords}.`);

    restoreAudit.phase="invariant_verification";
    const lifecycleDuplicate=await env.DB.prepare(`SELECT type,estimate_id AS estimateId,COUNT(*) AS count
      FROM notifications
      WHERE estimate_id IS NOT NULL AND type IN ('estimate_viewed','invoice_viewed','estimate_accepted')
      GROUP BY type,estimate_id HAVING COUNT(*)>1 LIMIT 1`).first<{type:string;estimateId:string;count:number}>();
    if(lifecycleDuplicate)return postWriteFailure(`Restore verification failed: duplicate lifecycle notification remains for ${lifecycleDuplicate.type}/${lifecycleDuplicate.estimateId}.`);
    restoreAudit.lifecycleNotificationUniquenessVerified=true;

    const relationshipChecks=[
      ["invoice",`SELECT inv.id FROM invoices inv LEFT JOIN estimates e ON e.id=inv.estimate_id LEFT JOIN customers c ON c.id=inv.customer_id WHERE e.id IS NULL OR c.id IS NULL LIMIT 1`],
      ["payment",`SELECT p.id FROM payments p LEFT JOIN estimates e ON e.id=p.estimate_id WHERE e.id IS NULL LIMIT 1`],
      ["refund",`SELECT r.id FROM payment_refunds r LEFT JOIN payments p ON p.id=r.payment_id LEFT JOIN estimates e ON e.id=r.estimate_id WHERE p.id IS NULL OR e.id IS NULL OR p.estimate_id<>r.estimate_id LIMIT 1`],
      ["checkout",`SELECT pcs.id FROM payment_checkout_sessions pcs LEFT JOIN estimates e ON e.id=pcs.estimate_id WHERE e.id IS NULL LIMIT 1`],
      ["invoice item",`SELECT ii.id FROM invoice_items ii LEFT JOIN invoices inv ON inv.id=ii.invoice_id WHERE inv.id IS NULL LIMIT 1`],
      ["invoice revision",`SELECT ir.id FROM invoice_revisions ir LEFT JOIN invoices inv ON inv.id=ir.invoice_id WHERE inv.id IS NULL LIMIT 1`],
      ["job report",`SELECT jr.id FROM job_reports jr LEFT JOIN estimates e ON e.id=jr.estimate_id LEFT JOIN customers c ON c.id=jr.customer_id WHERE e.id IS NULL OR c.id IS NULL OR e.customer_id<>jr.customer_id LIMIT 1`],
    ] as const;
    for(const [label,sql] of relationshipChecks){
      const orphan=await env.DB.prepare(sql).first<{id:string}>();
      if(orphan)return postWriteFailure(`Restore verification failed: orphaned ${label} relationship remains for ${orphan.id}.`);
    }
    restoreAudit.relationshipIntegrityVerified=true;
    restoreAudit.phase="complete";

    const photoMetadataSkipped = Array.isArray(backupTables.customer_photos) ? backupTables.customer_photos.length : 0;
    return Response.json({
      restored: insertedRecords,
      verifiedRecords,
      lifecycleNotificationUniquenessVerified:true,
      relationshipIntegrityVerified:true,
      duplicatesPreserved: Math.max(0,verificationPlans.length-insertedRecords),
      legacyLifecycleNotificationsSkipped:lifecycleNormalization.skipped,
      photoMetadataSkipped,
      restoreAudit,
      message: "Missing records were restored and verified. Existing records were preserved and were not overwritten.",
    });
  } catch(error) {
    return Response.json({
      error: restoreAudit.writesAttempted
        ? "The restore did not fully verify after database writes. Inspect the restore audit before retrying."
        : "The backup could not be restored. No restore writes were attempted.",
      restoreAudit,
    }, { status: restoreAudit.writesAttempted ? 500 : 400 });
  }
}
