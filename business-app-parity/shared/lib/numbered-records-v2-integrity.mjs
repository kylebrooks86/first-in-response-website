/** FIRE v2 FULL-DATABASE financial/document/photo preflight (SOURCE ONLY).
 * No D1, provider, filesystem, Stripe, deployment, or writes. Use on one
 * consistent full-table snapshot before backup and before any restore plan.
 * Structural/cryptographic checks are not source authentication and do NOT
 * replace the original owner-bound backup/restore permission checks.
 */
import {validateDepositAuditIntegrity} from './deposit-audit-backup.mjs';
import {validateSignedAgreementSnapshots,verifySignedAgreementDigests} from './deposit-agreement-backup.mjs';
import {FIRE_NUMBERED_RECORDS_TABLES,inspectNumberedRecordsV2} from './numbered-records-v2.mjs';

const fail=reason=>{throw new Error('FIRE v2 FINANCIAL INTEGRITY REFUSED: '+reason);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const money=n=>Number.isSafeInteger(n);
const text=x=>typeof x==='string'&&x.trim().length>0;

function allRows(tables,name){
 const rows=tables[name];
 if(!Array.isArray(rows)||rows.some(r=>!object(r)))fail('invalid or missing '+name+' records');
 return rows;
}
function identities(tables,name,column='id'){
 const index=new Map();
 for(const r of allRows(tables,name)){
  if(!text(r[column])||index.has(r[column]))fail('blank/duplicate '+name+' identity');
  index.set(r[column],r);
 }
 return index;
}
function ownerOf(map,id){
 const row=map.get(id);
 if(!row)fail('unrecognized linked parent');
 return row;
}
function checkLink(rows,field,parents,{optional=false}={}){
 for(const row of rows){
  if(optional&&row[field]==null)continue;
  if(!text(row[field])||!parents.has(row[field]))fail('missing linked '+field+' record');
 }
}
function inspectRefundLedger(tables,payments,estimates){
 const refunds=identities(tables,'payment_refunds');
 const providerRefunds=new Set(),validNegative=new Set(),reserved=new Map();
 for(const r of refunds.values()){
  const payment=ownerOf(payments,r.payment_id);
  if(!estimates.has(r.estimate_id)||payment.estimate_id!==r.estimate_id)
    fail('refund crosses payment/estimate ownership');
  if(payment.status!=='paid'||!money(payment.amount_cents)||payment.amount_cents<=0||
     !money(r.amount_cents)||r.amount_cents<=0||!['stripe','manual'].includes(r.mode)||
     !['pending','succeeded','failed'].includes(r.status))
    fail('refund amount, payment or state is invalid');
  if(r.provider_refund_id!=null){
   if(!text(r.provider_refund_id)||providerRefunds.has(r.provider_refund_id))
     fail('duplicate or invalid provider refund');
   providerRefunds.add(r.provider_refund_id);
  }
  if(r.status==='pending'||r.status==='succeeded'){
   const total=(reserved.get(r.payment_id)??0)+r.amount_cents;
   if(!Number.isSafeInteger(total)||total>payment.amount_cents)
     fail('refunds exceed paid principal');
   reserved.set(r.payment_id,total);
  }
  if(r.status==='succeeded'){
   const provider='refund:'+r.payment_id+':'+r.id;
   const rows=allRows(tables,'payments').filter(p=>p.provider_id===provider);
   const expectedType=payment.type==='Tip'?'Tip Refund':'Refund';
   if(rows.length!==1||rows[0].amount_cents!==-r.amount_cents||
      rows[0].status!=='paid'||rows[0].type!==expectedType||
      rows[0].estimate_id!==r.estimate_id)
     fail('succeeded refund is missing its exact negative payment ledger record');
   validNegative.add(provider);
  }
 }
 const providers=new Set();
 for(const row of payments.values()){
  if(!estimates.has(row.estimate_id)||!money(row.amount_cents)||!text(row.type)||
     !text(row.status))
    fail('payment ledger row has invalid relationship/amount/status');
  const provider=row.provider_id;
  if(typeof provider==='string'&&(provider.startsWith('cs_')||provider.startsWith('refund:'))){
   if(providers.has(provider))fail('duplicate payment provider reference');
   providers.add(provider);
  }
  if(typeof provider==='string'&&provider.startsWith('refund:')&&
      !validNegative.has(provider))
    fail('orphan negative refund payment ledger row');
 }
 return refunds.size;
}
function inspectPhotoMetadata(tables,customers,estimates){
 const objects=new Set();
 for(const p of identities(tables,'customer_photos').values()){
  if(!customers.has(p.customer_id)||
     (p.estimate_id!=null&&(!estimates.has(p.estimate_id)||
      estimates.get(p.estimate_id).customer_id!==p.customer_id)))
    fail('photo metadata refers to missing or different customer/estimate');
  if(!text(p.object_key)||!p.object_key.startsWith('customers/'+p.customer_id+'/'+p.id+'.')||
     p.object_key.includes('..')||objects.has(p.object_key))
    fail('photo key is missing, duplicated, or outside customer scope');
  objects.add(p.object_key);
  if(!text(p.content_type)||!p.content_type.startsWith('image/')||
     !['before','after','property'].includes(p.category)||
     !Number.isSafeInteger(p.size_bytes)||p.size_bytes<0||p.size_bytes>20*1024*1024)
    fail('photo metadata has an unsupported file size/type/category');
 }
}
export async function verifyNumberedRecordsV2CriticalIntegrity(tables){
 if(!object(tables)||Object.keys(tables).sort().join('|')!==
      [...FIRE_NUMBERED_RECORDS_TABLES].sort().join('|'))
   fail('record-family inventory differs from approved v2 scope');
 for(const key of FIRE_NUMBERED_RECORDS_TABLES)allRows(tables,key);
 const customers=identities(tables,'customers');
 const estimates=identities(tables,'estimates');
 const invoices=identities(tables,'invoices');
 const payments=identities(tables,'payments');
 const estimateOwner=id=>ownerOf(estimates,id).customer_id;
 checkLink([...estimates.values()],'customer_id',customers);
 for(const row of invoices.values()){
  if(!customers.has(row.customer_id)||estimateOwner(row.estimate_id)!==row.customer_id)
   fail('invoice belongs to different/missing customer');
 }
 for(const [child,parent,field] of [
  ['estimate_items',estimates,'estimate_id'],
  ['invoice_items',invoices,'invoice_id'],
  ['invoice_revisions',invoices,'invoice_id'],
  ['payment_checkout_sessions',estimates,'estimate_id'],
  ['customer_notes',customers,'customer_id'],
  ['customer_messages',customers,'customer_id'],
  ['estimate_change_requests',estimates,'estimate_id'],
  ['tasks',customers,'customer_id'],
  ['expenses',estimates,'estimate_id'],
  ['job_reports',estimates,'estimate_id']
 ]){
  const optional=(child==='tasks'||child==='expenses');
  checkLink(allRows(tables,child),field,parent,{optional});
 }
 for(const kind of ['customer_messages','estimate_change_requests','job_reports']){
  for(const row of allRows(tables,kind)){
   if(row.estimate_id!=null&&
      (estimateOwner(row.estimate_id)!==row.customer_id||!customers.has(row.customer_id)))
    fail('record references another customer estimate');
  }
 }
 for(const row of allRows(tables,'notifications')){
  if(row.customer_id!=null&&!customers.has(row.customer_id))fail('notification has missing customer');
  if(row.estimate_id!=null&&!estimates.has(row.estimate_id))fail('notification has missing estimate');
 }
 inspectRefundLedger(tables,payments,estimates);
 const audit=validateDepositAuditIntegrity(tables,true);
 if(audit)fail('deposit policy history integrity');
 const signed=validateSignedAgreementSnapshots(tables,true);
 if(signed)fail('signed agreement relationships or terms');
 // In this reviewed v2 schema an estimate that declares a signed exception
 // digest must also retain its immutable snapshot; the old validator
 // validates present rows, not the absence of an already-signed artifact.
 for(const estimate of estimates.values()){
  const version=estimate.contract_version;
  if(typeof version==='string'&&version.startsWith('deposit-exception-v1:')&&
     !tables.deposit_agreement_snapshots.some(s=>
       s.estimate_id===estimate.id&&version===s.document_version+':sha256:'+s.document_digest))
    fail('signed estimate commitment has no matching immutable document');
 }
 const digest=await verifySignedAgreementDigests(tables);
 if(digest)fail('signed agreement cryptographic digest');
 inspectPhotoMetadata(tables,customers,estimates);
 return true;
}


/** Strict review of an already packaged v2 archive prior to a restore plan.
 * Requires BOTH byte-integrity/full identity coverage and underlying current
 * deposit/refund/signed-agreement/photo metadata contract validation.
 * Does not authenticate who created the archive or restore any records.
 */
export async function inspectFinanciallyVerifiedNumberedRecordsV2(archive){
 const summary=await inspectNumberedRecordsV2(archive);
 await verifyNumberedRecordsV2CriticalIntegrity(archive.records.tables);
 return Object.freeze({...summary,financialAuditContractVerified:true,
   signedDocumentTextDigestVerified:true,photoMetadataOnly:true,
   photoFilesRecovered:false,ownerAuthenticated:false,hostedWritesPerformed:false});
}
