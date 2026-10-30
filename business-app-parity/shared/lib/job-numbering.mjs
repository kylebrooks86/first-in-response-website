/** FIRE Job # source contract.
 * Internal UUIDs remain unchanged. One permanent job number is shared by a
 * first estimate, its signed revisions, its schedule and its final invoice.
 * New estimates allocate in the SAME atomic D1 batch as the new estimate row.
 * Importing this module never connects to D1 or modifies a database.
 */
export const JOB_NUMBER_FOR_ESTIMATE_SQL =
  'SELECT job_number AS jobNumber FROM fire_job_estimate_links WHERE estimate_id=?';

export const COMPLETED_JOB_COUNT_SQL =
  "SELECT COUNT(DISTINCT links.job_number) AS completedJobs FROM fire_job_estimate_links links JOIN estimates e ON e.id=links.estimate_id WHERE e.status='completed'";

export const JOB_REFERENCE_BY_INVOICE_SQL =
  'SELECT links.job_number AS jobNumber FROM invoices inv JOIN fire_job_estimate_links links ON links.estimate_id=inv.estimate_id WHERE inv.id=?';

export function jobNumberLabel(value) {
  const number = typeof value==='number' ? value
    : typeof value==='string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0
    ? 'Job #' + String(number).padStart(4,'0') : null;
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
    const sql='SELECT estimate_id AS estimateId,job_number AS jobNumber FROM fire_job_estimate_links WHERE estimate_id IN ('+batch.map(()=>'?').join(',')+')';
    const found=await db.prepare(sql).bind(...batch).all();
    for(const row of found.results??[]) {
      if(jobNumberLabel(row.jobNumber)) numbers.set(row.estimateId,row.jobNumber);
    }
  }
  return numbers;
}
