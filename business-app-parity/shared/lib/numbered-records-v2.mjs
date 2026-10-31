/** FIRE numbered-records v2 content packer/reader — SOURCE ONLY.
 * No API, database, filesystem, provider, network, deployment or restore calls.
 * The existing v1 JSON backup/restore HTTP 409 lock MUST remain in place.
 * All 21 application tables are exact-scope; later service-location/property variants require
 * an explicitly reviewed schema version, never silent omission.
 * SHA-256 detects accidental alteration, NOT authenticity or authorization.
 * Customer photo BYTES are never in this database-record package.
 */
import {validateNumberedIdentityArchive} from './numbered-identity-archive.mjs';

export const FIRE_NUMBERED_RECORDS_FORMAT='fire-app-numbered-records';
export const FIRE_NUMBERED_RECORDS_VERSION=2;
export const FIRE_NUMBERED_RECORDS_TABLES=Object.freeze([
  'customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions',
  'payment_checkout_sessions','payment_refunds','deposit_policy_events',
  'deposit_agreement_snapshots','estimate_items','payments','customer_photos',
  'customer_messages','notifications','message_templates','estimate_change_requests',
  'tasks','expenses','job_reports','auth_rate_limits'
]);

function reject(reason){throw new Error('FIRE numbered records v2 REFUSED: '+reason);}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value,keys,label){
  if(!object(value))reject(label+' is not an object');
  const actual=Object.keys(value).sort().join('|');
  if(actual!==[...keys].sort().join('|'))reject(label+' has missing or unreviewed fields');
}
function canonical(value,depth=0){
  if(depth>36)reject('archive nesting is excessive');
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value)||!Number.isSafeInteger(value)&&!Number.isFinite(value))reject('invalid numeric value');
    return JSON.stringify(value);
  }
  if(Array.isArray(value))return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';
  if(!object(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
    reject('non-JSON value');
  const keys=Object.keys(value).sort();
  if(keys.some(k=>k==='__proto__'||k==='prototype'||k==='constructor'))reject('unsafe object key');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
}
async function sha256(value){
  if(!globalThis.crypto?.subtle)reject('Web Crypto SHA-256 unavailable; cannot build or inspect');
  const b=new TextEncoder().encode(canonical(value));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',b);
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
function index(rows,key,label){
  const out=new Map();
  for(const row of rows){
    if(!object(row)||typeof row[key]!=='string'||!row[key].trim()||out.has(row[key]))
      reject(label+' contains a missing or duplicate identity');
    out.set(row[key],row);
  }
  return out;
}
function review(records,identities){
  exactKeys(records,['format','version','exportedAt','includes','warning','tables'],'records source');
  if(records.format!=='fire-app-records-backup'||records.version!==1||
     typeof records.exportedAt!=='string'||!Number.isFinite(Date.parse(records.exportedAt)))
    reject('records source is not the reviewed legacy full-record format');
  if(typeof records.warning!=='string')reject('photo warning absent');
  if(!object(records.includes)||Object.keys(records.includes).sort().join('|')!==[
     'databaseRecords','photoMetadata','photoFiles','invoiceRevisionHistory',
     'paymentCheckoutSessionSafety','paymentRefundHistory','depositPolicyAuditHistory',
     'signedDepositAgreementHistory'].sort().join('|'))
    reject('records completeness markers changed');
  for(const key of ['databaseRecords','photoMetadata','invoiceRevisionHistory',
                    'paymentCheckoutSessionSafety','paymentRefundHistory',
                    'depositPolicyAuditHistory','signedDepositAgreementHistory'])
    if(records.includes[key]!==true)reject('required record family not included: '+key);
  if(records.includes.photoFiles!==false)reject('unexpected embedded photo data');
  exactKeys(records.tables,FIRE_NUMBERED_RECORDS_TABLES,'records table inventory');
  const counts={};
  for(const table of FIRE_NUMBERED_RECORDS_TABLES){
    const rows=records.tables[table];
    if(!Array.isArray(rows)||rows.some(r=>!object(r)))reject('missing or invalid '+table+' records');
    counts[table]=rows.length;
  }
  const proof=validateNumberedIdentityArchive(identities);
  const customer=index(records.tables.customers,'id','customers');
  const estimates=index(records.tables.estimates,'id','estimates');
  if(customer.size!==proof.customers||estimates.size!==proof.estimates)
    reject('numbered identities do not cover every saved customer and estimate');
  const check=(source,lookup,fields,label)=>{
    for(const row of source){
      const saved=lookup.get(row.id);
      if(!saved||fields.some(field=>typeof row[field]!=='string'||row[field]!==saved[field]))
        reject(label+' original identity/time/ownership differs from saved records');
    }
  };
  check(identities.customers,customer,['id','created_at'],'customer');
  check(identities.estimates,estimates,['id','customer_id','created_at'],'estimate');
  return {counts,proof};
}
function snapshot(value){
  // Immutable detached JSON snapshot before hashing, without accepting
  // undefined, BigInt, sparse arrays, NaN, functions or circular objects.
  return JSON.parse(canonical(value));
}
function summary(manifest,proof){
  return Object.freeze({recordTables:Object.keys(manifest).length,recordRows:Object.values(manifest).reduce((a,b)=>a+b,0),
    customers:proof.customers,estimates:proof.estimates,
    customerNumbers:proof.customerNumbers,jobNumbers:proof.jobNumbers,
    jobLinks:proof.jobLinks,customerHighWater:proof.customerHighWater,
    jobHighWater:proof.jobHighWater,photoFilesIncluded:false,
    actualRestoreImplemented:false,remoteWritesPerformed:false});
}

/** Pack a trusted full v1 records read and a complete numbered-identity read.
 * Caller must first perform existing refund/deposit/agreement integrity checks,
 * then obtain a consistent one-snapshot read of ALL D1 tables and sequences.
 * This library alone cannot attest snapshot consistency or photo-file custody.
 */
export async function buildNumberedRecordsV2({records,identities}){
  const r=snapshot(records),ids=snapshot(identities);
  const {counts,proof}=review(r,ids);
  const payload={format:FIRE_NUMBERED_RECORDS_FORMAT,version:FIRE_NUMBERED_RECORDS_VERSION,
    allRecordsComplete:true,truncated:false,photoFilesIncluded:false,
    records:r,identities:ids,tableCounts:counts};
  const checksum=await sha256(payload);
  const archive={...payload,checksum:{algorithm:'SHA-256',hex:checksum}};
  return {archive,summary:summary(counts,proof)};
}

/** Read/validate a v2 package; no restore or database writes. */
export async function inspectNumberedRecordsV2(value){
  const archive=snapshot(value);
  exactKeys(archive,['format','version','allRecordsComplete','truncated','photoFilesIncluded',
    'records','identities','tableCounts','checksum'],'v2 envelope');
  if(archive.format!==FIRE_NUMBERED_RECORDS_FORMAT||archive.version!==FIRE_NUMBERED_RECORDS_VERSION||
    archive.allRecordsComplete!==true||archive.truncated!==false||archive.photoFilesIncluded!==false)
    reject('unsupported version/completeness/photo claim');
  exactKeys(archive.checksum,['algorithm','hex'],'checksum');
  if(archive.checksum.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(archive.checksum.hex))
    reject('invalid checksum');
  const {counts,proof}=review(archive.records,archive.identities);
  exactKeys(archive.tableCounts,FIRE_NUMBERED_RECORDS_TABLES,'table count inventory');
  for(const table of FIRE_NUMBERED_RECORDS_TABLES)
    if(archive.tableCounts[table]!==counts[table])reject('row count mismatch: '+table);
  const {checksum,...payload}=archive;
  const digest=await sha256(payload);
  if(digest!==checksum.hex)reject('archive contents differ from recorded SHA-256 checksum');
  return summary(counts,proof);
}
