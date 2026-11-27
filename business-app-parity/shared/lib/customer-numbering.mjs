/** Permanent customer numbers. Internal UUIDs, estimates, job references,
 * invoice links, payment IDs and sharing tokens stay unchanged.
 *
 * This is gated off until a target-specific PRIVATE historical backfill and
 * schema/triggers have been verified. Imports never write or contact D1.
 */
export const CUSTOMER_NUMBER_FLAG='owner-approved-schema-v1';

export function customerNumberLabel(value){
  const n=typeof value==='number'?value:
    typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):NaN;
  return Number.isSafeInteger(n)&&n>0?'Customer #'+String(n).padStart(4,'0'):null;
}

/** Match an explicit permanent Customer # or a padded 4+-digit exact number.
 * Keep the ordinary name/address/phone search independent; never treat a
 * 1-3 digit bare query as an ID and never match an ID by prefix.
 */
export function parseCustomerNumberQuery(query){
  if(typeof query!=='string')return null;
  const term=query.trim().toLowerCase();
  const explicit=/^(?:customer\s*#?\s*|#)0*([1-9]\d*)$/.exec(term);
  const padded=/^\d{4,}$/.test(term)?/^0*([1-9]\d*)$/.exec(term):null;
  const number=explicit?.[1]??padded?.[1];
  if(!number)return null;
  const parsed=Number(number);
  return Number.isSafeInteger(parsed)&&parsed>0?parsed:null;
}
export function matchesCustomerNumberQuery(customerNumber,query){
  if(!customerNumberLabel(customerNumber))return false;
  return parseCustomerNumberQuery(query)===Number(customerNumber);
}

/** Fail closed if flag is enabled without a complete immutable numbering map.
 * Call after owner authorization or successful opaque customer share-token
 * resolution, never from an unauthenticated directory query.
 */
export async function customerNumberingReady(db,environment){
  if(environment?.FIRE_CUSTOMER_NUMBERS_CANDIDATE!==CUSTOMER_NUMBER_FLAG)return false;
  const schema=await db.prepare(
    "SELECT name FROM sqlite_master WHERE (type='table' AND name='fire_customer_numbers') OR (type='trigger' AND name IN ('fire_customer_numbers_no_update','fire_customer_numbers_no_delete'))"
  ).all();
  const names=new Set((schema.results||[]).map(item=>item.name));
  if(!['fire_customer_numbers','fire_customer_numbers_no_update','fire_customer_numbers_no_delete'].every(x=>names.has(x)))
    throw new Error('Permanent customer-number migration is not verified.');
  const coverage=await db.prepare(
    'SELECT COUNT(*) AS missing FROM customers c LEFT JOIN fire_customer_numbers n ON n.customer_id=c.id WHERE n.customer_id IS NULL'
  ).first();
  if(!coverage||!Number.isSafeInteger(Number(coverage.missing))||Number(coverage.missing)!==0)
    throw new Error('Historical customer numbering requires a verified backfill.');
  return true;
}

/** This prepared statement runs only in the SAME atomic D1 batch as the new
 * customer INSERT, never on a detached request/retry or owner screen.
 */
export function newCustomerNumberStatement(db,customerId,createdAt){
  if(typeof customerId!=='string'||!/^[0-9a-f-]{36}$/i.test(customerId)||
     typeof createdAt!=='string'||!Number.isFinite(Date.parse(createdAt)))
    throw new TypeError('Saved customer ID and timestamp are required.');
  return db.prepare(
    'INSERT INTO fire_customer_numbers(customer_id,created_at) SELECT id,created_at FROM customers WHERE id=? AND NOT EXISTS (SELECT 1 FROM fire_customer_numbers WHERE customer_id=?)'
  ).bind(customerId,customerId);
}

export async function customerNumberForCustomer(db,customerId,environment){
  if(!await customerNumberingReady(db,environment))return null;
  const record=await db.prepare(
    'SELECT customer_number AS customerNumber FROM fire_customer_numbers WHERE customer_id=?'
  ).bind(customerId).first();
  if(!customerNumberLabel(record?.customerNumber))
    throw new Error('Saved customer has no permanent number.');
  return Number(record.customerNumber);
}

/** One completed job per permanent Job #, not per invoice or revision.
 * In older/unmigrated sources, completed estimate IDs are the only reliable
 * distinct key; no serial is ever guessed or fabricated.
 */
export function completedCustomerJobHistory(estimates){
  if(!Array.isArray(estimates))return [];
  const seen=new Set();
  return estimates.filter(row=>row&&row.status==='completed'&&typeof row.id==='string')
    .sort((a,b)=>(Date.parse(b.scheduledAt||b.createdAt)||0)-(Date.parse(a.scheduledAt||a.createdAt)||0)||String(b.id).localeCompare(String(a.id)))
    .filter(row=>{
      const label=customerNumberLabel(row.jobNumber);
      const key=label?'job:'+Number(row.jobNumber):'estimate:'+row.id;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
}
