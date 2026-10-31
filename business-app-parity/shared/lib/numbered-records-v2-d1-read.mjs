/** FIRE numbered records v2: SOURCE-ONLY transactional D1 READ adapter.
 * NO route invokes this. Do not deploy/enable before owner-only authorization,
 * current refund/deposit/agreement/photo integrity validators, photo ZIP custody,
 * target schema migration, and lossless atomic RESTORE are independently reviewed.
 *
 * Every query is a constant allowlisted SELECT (no mutation, no SQL from caller).
 * Cloudflare D1 batch() executes statements together transactionally.
 * The caller-supplied integrityVerifier MUST run the current LIVE-appropriate
 * record/financial/document validation and return literal true to proceed.
 * This module alone cannot authenticate an owner or verify signed content.
 */
import {buildNumberedRecordsV2,FIRE_NUMBERED_RECORDS_TABLES}
  from './numbered-records-v2.mjs';
import {NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION}
  from './numbered-identity-archive.mjs';

const NUMBER_TABLES=Object.freeze([
  'fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'
]);
export const FIRE_NUMBERED_V2_READ_TABLES=Object.freeze([
  ...FIRE_NUMBERED_RECORDS_TABLES,...NUMBER_TABLES
]);
const SEQUENCE_SQL="SELECT name, seq FROM sqlite_sequence WHERE name IN ('fire_customer_numbers','fire_job_numbers') ORDER BY name";

function fail(reason){throw new Error('FIRE numbered D1 READ REFUSED: '+reason);}
function hasRows(reply){return reply&&reply.success===true&&Array.isArray(reply.results)&&reply.results.every(r=>r!==null&&typeof r==='object'&&!Array.isArray(r));}
function seqHighWater(rows,name,identityCount){
  const matched=rows.filter(r=>r.name===name);
  if(matched.length>1)fail('duplicated SQLite sequence for '+name);
  if(!matched.length){
    if(identityCount)fail('missing SQLite high-water for numbered data');
    return 0;
  }
  const value=matched[0].seq;
  if(!Number.isSafeInteger(value)||value<0)fail('invalid SQLite number allocator');
  return value;
}
/** Run one read-only batch on a trusted, pre-authorized D1 binding.
 * No cloud calls unless a separately authorized caller explicitly invokes it.
 * Never use with a proxy/wrapper that can't guarantee transactional D1 batch.
 */
export async function captureNumberedRecordsV2FromD1({
 db,integrityVerifier,now=()=>new Date().toISOString()
}={}){
  if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
    fail('reviewed D1 binding with prepare and batch is required');
  if(typeof integrityVerifier!=='function')fail('record, refund, agreement and photo checks are required');
  if(typeof now!=='function')fail('valid capture clock required');
  const statements=FIRE_NUMBERED_V2_READ_TABLES.map(table=>
    db.prepare('SELECT * FROM "'+table+'"'));
  statements.push(db.prepare(SEQUENCE_SQL));
  // Source-only; all SELECTs in ONE D1 transactional batch, no writes.
  const batch=await db.batch(statements);
  if(!Array.isArray(batch)||batch.length!==statements.length||!batch.every(hasRows))
    fail('incomplete, failed or unreviewed transactional D1 batch');
  const read=Object.fromEntries(FIRE_NUMBERED_V2_READ_TABLES.map((table,i)=>[table,batch[i].results]));
  const seq=batch[batch.length-1].results;
  if(seq.some(r=>!['fire_customer_numbers','fire_job_numbers'].includes(r.name)))
    fail('unexpected SQLite sequence row');
  if(seq.length!==new Set(seq.map(r=>r.name)).size)
    fail('duplicate SQLite sequence name');
  const counts={
    customer:seqHighWater(seq,'fire_customer_numbers',read.fire_customer_numbers.length),
    job:seqHighWater(seq,'fire_job_numbers',read.fire_job_numbers.length)
  };
  if(await integrityVerifier(read)!==true)
    fail('full pre-export integrity verification was not affirmatively accepted');
  const at=now();
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))
    fail('invalid source capture time');
  const tables=Object.fromEntries(FIRE_NUMBERED_RECORDS_TABLES.map(key=>[key,read[key]]));
  const records={format:'fire-app-records-backup',version:1,exportedAt:at,
    includes:{
      databaseRecords:true,photoMetadata:true,photoFiles:false,
      invoiceRevisionHistory:true,paymentCheckoutSessionSafety:true,
      paymentRefundHistory:true,depositPolicyAuditHistory:true,
      signedDepositAgreementHistory:true
    },
    warning:'Database customer photo metadata is included, but actual photo files are NOT in this archive.',
    tables};
  const identities={format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,
    version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
    allTablesComplete:true,truncated:false,
    customers:read.customers.map(({id,created_at})=>({id,created_at})),
    estimates:read.estimates.map(({id,customer_id,created_at})=>({id,customer_id,created_at})),
    fire_customer_numbers:read.fire_customer_numbers,
    fire_job_numbers:read.fire_job_numbers,
    fire_job_estimate_links:read.fire_job_estimate_links,
    highWater:counts};
  return buildNumberedRecordsV2({records,identities});
}
