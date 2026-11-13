/** FIRE Job # source contract.
 * Internal UUIDs remain unchanged. One permanent job number is shared by a
 * first estimate, its signed revisions, its schedule and its final invoice.
 * New estimates allocate in the SAME atomic D1 batch as the new estimate row.
 * Importing this module never connects to D1 or modifies a database.
 */
/** Gate only the separately owner-enabled Job # candidate.
 * A schema existing by name is not sufficient: every historical estimate must
 * have exactly one original identity link, every Job # its real root link, and
 * no quote revision may borrow a different customer's permanent number.
 * Feature-off Workers never query experimental tables.
 */
export const JOB_NUMBER_FLAG='owner-approved-schema-v1';

export async function jobNumberingReady(db,environment){
  if(environment?.FIRE_JOB_NUMBERS_CANDIDATE!==JOB_NUMBER_FLAG)return false;
  const schema=await db.prepare(
    "SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('fire_job_numbers','fire_job_estimate_links')) AS tables, "+
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('fire_job_numbers_no_update','fire_job_numbers_no_delete','fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete')) AS triggers"
  ).first();
  if(Number(schema?.tables)!==2||Number(schema?.triggers)!==4)
    throw new Error('Permanent Job # schema and immutable triggers are not verified.');
  const coverage=await db.prepare(
    "SELECT "+
    "(SELECT COUNT(*) FROM estimates e LEFT JOIN fire_job_estimate_links l ON l.estimate_id=e.id WHERE l.estimate_id IS NULL)+"+
    "(SELECT COUNT(*) FROM fire_job_numbers j LEFT JOIN fire_job_estimate_links l ON l.estimate_id=j.root_estimate_id AND l.job_number=j.job_number WHERE l.estimate_id IS NULL)+"+
    "(SELECT COUNT(*) FROM fire_job_estimate_links l LEFT JOIN estimates e ON e.id=l.estimate_id LEFT JOIN fire_job_numbers j ON j.job_number=l.job_number LEFT JOIN estimates root ON root.id=j.root_estimate_id WHERE e.id IS NULL OR j.job_number IS NULL OR root.id IS NULL OR e.customer_id<>root.customer_id OR j.created_at<>root.created_at) "+
    "AS invalid"
  ).first();
  if(!coverage||!Number.isSafeInteger(Number(coverage.invalid))||Number(coverage.invalid)!==0)
    throw new Error('Historical Job # links, original roots or customer ownership require verified backfill.');
  return true;
}

// Resolve through both the numbered root and original estimate ownership.
 // A corrupt cross-customer link must never become a displayed Job #.
export const JOB_NUMBER_FOR_ESTIMATE_SQL =
  'SELECT l.job_number AS jobNumber FROM fire_job_estimate_links l '+
  'JOIN estimates e ON e.id=l.estimate_id '+
  'JOIN fire_job_numbers j ON j.job_number=l.job_number '+
  'JOIN estimates root ON root.id=j.root_estimate_id '+
  'WHERE l.estimate_id=? AND e.customer_id=root.customer_id AND j.created_at=root.created_at '+
  'AND EXISTS (SELECT 1 FROM fire_job_estimate_links origin WHERE origin.estimate_id=root.id AND origin.job_number=j.job_number)';

export const COMPLETED_JOB_COUNT_SQL =
  "SELECT COUNT(DISTINCT links.job_number) AS completedJobs FROM fire_job_estimate_links links JOIN estimates e ON e.id=links.estimate_id WHERE e.status='completed'";

export const JOB_REFERENCE_BY_INVOICE_SQL =
  'SELECT links.job_number AS jobNumber FROM invoices inv '+
  'JOIN estimates e ON e.id=inv.estimate_id '+
  'JOIN fire_job_estimate_links links ON links.estimate_id=e.id '+
  'JOIN fire_job_numbers j ON j.job_number=links.job_number '+
  'JOIN estimates root ON root.id=j.root_estimate_id '+
  'WHERE inv.id=? AND inv.customer_id=e.customer_id AND e.customer_id=root.customer_id '+
  'AND j.created_at=root.created_at '+
  'AND EXISTS (SELECT 1 FROM fire_job_estimate_links origin WHERE origin.estimate_id=root.id AND origin.job_number=j.job_number)';

export function jobNumberLabel(value) {
  const number = typeof value==='number' ? value
    : typeof value==='string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0
    ? 'Job #' + String(number).padStart(4,'0') : null;
}

/** Owner-side lookup contract. Require an explicit Job prefix or at least
 * four digits, so searching for a street number "7" does NOT silently match
 * Job #0007. Never use this parser to authorize a customer-visible lookup.
 * Feature-off callers must not search experimental tables.
 */
export function parseJobNumberQuery(input) {
  if(typeof input!=='string')return null;
  const text=input.trim().toLowerCase();
  if(!text||text.length>128)return null;
  const explicit=/^(?:job\s*#?\s*|#)0*([1-9]\d{0,14})$/.exec(text);
  const padded=/^0+[1-9]\d{0,14}$/.test(text)?/^0*([1-9]\d{0,14})$/.exec(text):null;
  const raw=explicit?.[1]??(text.length>=4?padded?.[1]:null);
  if(!raw)return null;
  const number=Number(raw);
  return Number.isSafeInteger(number)&&number>0?number:null;
}
export function matchesJobNumberQuery(value,query) {
  return Boolean(jobNumberLabel(value))&&parseJobNumberQuery(query)===Number(value);
}

/** Call ONLY in the same atomic batch that persists a first estimate. */
export function newJobStatements(db, estimateId, createdAt) {
  if (typeof estimateId !== 'string' || !/^[0-9a-f-]{36}$/i.test(estimateId) ||
      typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    throw new TypeError('New FIRE job requires a saved estimate ID and creation time');
  }
  return [
    db.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)')
      .bind(estimateId,createdAt),
    db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_numbers WHERE root_estimate_id=?')
      .bind(estimateId,estimateId)
  ];
}

/** New quote revisions keep their original job number. A missing original link
 * must block the operation; it must never silently allocate a second Job #.
 * The caller must assert that exactly one link was inserted.
 */
export function replacementJobStatement(db, newEstimateId, previousEstimateId) {
  if (![newEstimateId, previousEstimateId].every(
      x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) ||
      newEstimateId === previousEstimateId) {
    throw new TypeError('Replacement must reference two distinct estimate IDs');
  }
  return db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_estimate_links WHERE estimate_id=?')
    .bind(newEstimateId,previousEstimateId);
}

export function completedJobCount(row) {
  const value=row?.completedJobs;
  return Number.isSafeInteger(value) && value>=0 ? value : null;
}

/** Safe customer-link read. Call ONLY after an estimate or invoice was resolved
 * using its existing unguessable share token. A not-yet-migrated database
 * omits Job # rather than inventing or exposing a wrong number.
 */
export async function jobNumberLabelForEstimate(db, estimateId) {
  const available=await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fire_job_estimate_links'"
  ).first();
  if (!available) return null;
  const row=await db.prepare(JOB_NUMBER_FOR_ESTIMATE_SQL).bind(estimateId).first();
  return jobNumberLabel(row?.jobNumber);
}

/** Owner-only batched read (after existing auth checks).
 * Missing schema is a source rollout compatibility case, never a made-up ID.
 * Keep SQL placeholders bounded for older or larger invoice histories.
 */
export async function attachedJobNumbers(db, estimateIds) {
  const ids=[...new Set(estimateIds.filter(id=>typeof id==='string'&&id.length>0))];
  if (!ids.length) return new Map();
  const hasTable=await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fire_job_estimate_links'"
  ).first();
  if (!hasTable) return new Map();
  const numbers=new Map();
  for(let offset=0;offset<ids.length;offset+=400) {
    const batch=ids.slice(offset,offset+400);
    const sql='SELECT l.estimate_id AS estimateId,l.job_number AS jobNumber '+
      'FROM fire_job_estimate_links l '+
      'JOIN estimates e ON e.id=l.estimate_id '+
      'JOIN fire_job_numbers j ON j.job_number=l.job_number '+
      'JOIN estimates root ON root.id=j.root_estimate_id '+
      'WHERE l.estimate_id IN ('+batch.map(()=>'?').join(',')+') '+
      'AND e.customer_id=root.customer_id AND j.created_at=root.created_at '+
      'AND EXISTS (SELECT 1 FROM fire_job_estimate_links origin WHERE origin.estimate_id=root.id AND origin.job_number=j.job_number)';
    const found=await db.prepare(sql).bind(...batch).all();
    for(const row of found.results??[]) {
      if(jobNumberLabel(row.jobNumber)) numbers.set(row.estimateId,row.jobNumber);
    }
  }
  return numbers;
}
