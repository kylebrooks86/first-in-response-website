/** FIRE NEW LIVE pre-activation: physical financial D1 index contract.
 * A claimed 26-row migration journal is NOT evidence that refund, Stripe,
 * invoice or one-open-checkout uniqueness actually exists on the bound D1.
 * SELECT-only, deterministic, no network, customer data, payments or writes.
 * Matches the specific reviewed doomsday migrations 0015/0017/0018/0019/0020/0022.
 */
const stop=why=>{throw Error('FIRE NEW LIVE financial indexes BLOCKED: '+why);};
const EXPECTED=Object.freeze({
 idx_invoices_one_per_estimate:
  "CREATE UNIQUE INDEX idx_invoices_one_per_estimate ON invoices(estimate_id)",
 idx_payment_checkout_sessions_one_open_per_estimate:
  "CREATE UNIQUE INDEX idx_payment_checkout_sessions_one_open_per_estimate ON payment_checkout_sessions(estimate_id) WHERE status='open'",
 idx_payment_refunds_estimate_status:
  "CREATE INDEX idx_payment_refunds_estimate_status ON payment_refunds(estimate_id,status)",
 idx_payment_refunds_payment_status:
  "CREATE INDEX idx_payment_refunds_payment_status ON payment_refunds(payment_id,status)",
 idx_payment_refunds_provider:
  "CREATE UNIQUE INDEX idx_payment_refunds_provider ON payment_refunds(provider_refund_id) WHERE provider_refund_id IS NOT NULL",
 idx_payments_stripe_provider_unique:
  "CREATE UNIQUE INDEX idx_payments_stripe_provider_unique ON payments(provider_id) WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'",
 idx_payments_unique_refund_provider:
  "CREATE UNIQUE INDEX idx_payments_unique_refund_provider ON payments(provider_id) WHERE provider_id LIKE 'refund:%'",
 // 0020's lifecycle uniqueness matters to estimate/invoice notifications.
 // A same-named non-unique replacement must not pass first-use release.
 idx_notifications_unique_lifecycle:
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_lifecycle ON notifications(type,estimate_id) WHERE estimate_id IS NOT NULL AND type IN ('estimate_viewed','invoice_viewed','estimate_accepted')"
});
export const REQUIRED_NEW_LIVE_FINANCIAL_INDEX_NAMES=Object.freeze(Object.keys(EXPECTED));
const canonical=sql=>{
 if(typeof sql!=='string'||sql.length>4096||!sql.trim())stop('missing or oversized index SQL');
 return sql.trim().replace(/;+\s*$/,'').replace(/[`"]/g,'')
  .replace(/\s+/g,' ').replace(/\s*\(\s*/g,'(')
  .replace(/\s*\)\s*/g,')').replace(/\s*,\s*/g,',')
  .replace(/\s*=\s*/g,'=').toLowerCase();
};
const expected=Object.freeze(Object.fromEntries(
 Object.entries(EXPECTED).map(([name,sql])=>[name,canonical(sql)])));
export async function verifyNewLiveFinancialIndexes(db){
 if(!db||typeof db.prepare!=='function')stop('bound physical D1 reader missing');
 const names=REQUIRED_NEW_LIVE_FINANCIAL_INDEX_NAMES;
 const quoted=names.map(name=>"'"+name+"'").join(',');
 const statement=db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name IN ("+
  quoted+") ORDER BY name");
 if(!statement||typeof statement.all!=='function')stop('D1 index inventory reader missing');
 const response=await statement.all();
 if(!response||!Array.isArray(response.results)||response.results.length!==names.length)
  stop('missing refund, payment, checkout, invoice or lifecycle notification indexes');
 const found=new Set();
 for(const row of response.results){
  if(!row||typeof row!=='object'||Array.isArray(row)||
     typeof row.name!=='string'||!Object.hasOwn(expected,row.name)||
     found.has(row.name))
   stop('unexpected or duplicate protected index metadata');
  found.add(row.name);
  if(canonical(row.sql)!==expected[row.name])
   stop('physical protected unique/partial index SQL differs from reviewed migration');
 }
 if(found.size!==names.length)stop('financial index inventory incomplete');
 return true;
}
