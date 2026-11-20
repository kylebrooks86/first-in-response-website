/** FIRE NEW LIVE activation must not accept extra named SQL indexes or views.
 * Source-approved 25 common + 1 independent-numbered migration set creates
 * these exact named indexes and NO VIEWS. SQLite-generated primary-key
 * autoindexes have sql=NULL and are correctly excluded from this inventory.
 * This supplements (not replaces) the source-exact financial index SQL test.
 * Read-only metadata inspection; no Cloudflare provider calls or writes.
 */
export const REVIEWED_INDEPENDENT_D1_NAMED_INDEXES=Object.freeze([
  'idx_estimate_items_estimate_id',
  'idx_estimates_customer_id',
  'idx_estimates_created_at',
  'idx_payments_estimate_status',
  'idx_customer_notes_customer_id',
  'idx_invoices_customer_id',
  'idx_invoices_estimate_id',
  'idx_estimates_scheduled_at',
  'idx_customer_messages_customer_id',
  'idx_customer_messages_estimate_id',
  'idx_customer_photos_customer_id',
  'idx_customer_photos_category',
  'idx_notifications_created_at',
  'idx_notifications_unread',
  'idx_estimates_share_token',
  'idx_invoices_share_token',
  'idx_change_requests_estimate',
  'idx_expenses_estimate',
  'idx_expenses_incurred',
  'idx_job_reports_estimate',
  'idx_tasks_status_due',
  'idx_invoice_items_invoice_id',
  'idx_invoice_revisions_invoice_id',
  'idx_payment_checkout_sessions_estimate_status',
  'idx_notifications_resolution',
  'idx_payment_checkout_sessions_one_open_per_estimate',
  'idx_invoices_one_per_estimate',
  'idx_payment_refunds_payment_status',
  'idx_payment_refunds_estimate_status',
  'idx_payment_refunds_provider',
  'idx_payments_unique_refund_provider',
  'idx_notifications_unique_lifecycle',
  'idx_payments_stripe_provider_unique',
  'idx_deposit_policy_events_estimate_time',
  'idx_deposit_agreement_snapshots_estimate',
  'idx_fire_job_estimate_links_number',
]);
const refuse=why=>{throw Error('FIRE independent D1 index/view inventory BLOCKED: '+why);};
export async function verifyNewLiveNamedIndexAndViewInventory(db){
 if(!db||typeof db.prepare!=='function')refuse('bound D1 reader unavailable');
 const query=db.prepare("SELECT type,name FROM sqlite_master WHERE type='view' OR (type='index' AND sql IS NOT NULL) ORDER BY type,name");
 if(!query||typeof query.all!=='function')refuse('SQL object inventory reader missing');
 const output=await query.all();
 const rows=output?.results;
 if(!Array.isArray(rows)||rows.length!==REVIEWED_INDEPENDENT_D1_NAMED_INDEXES.length)
  refuse('unknown SQL views, missing indexes or extra indexes');
 const expected=new Set(REVIEWED_INDEPENDENT_D1_NAMED_INDEXES),seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||row.type!=='index'||
     typeof row.name!=='string'||!expected.has(row.name)||seen.has(row.name))
   refuse('unexpected SQL view, modified index name or duplicate index');
  seen.add(row.name);
 }
 if(seen.size!==expected.size)refuse('reviewed named index set incomplete');
 return true;
}
