/** FIRE numbered-identity archive validation — SOURCE-ONLY contract.
 * No database, filesystem, provider, network or restoration side effects.
 * Existing v1 HTTP JSON backups remain LOCKED when numbering is enabled.
 * This validator is NOT authorization to deploy a numbered archive endpoint.
 */
export const NUMBERED_IDENTITY_ARCHIVE_FORMAT='fire-permanent-numbered-identities';
export const NUMBERED_IDENTITY_ARCHIVE_VERSION=1;

function fail(reason){throw new Error('Unsafe FIRE numbered-identity archive: '+reason);}
function rows(value,field){
  if(!Array.isArray(value))fail(field+' must be a complete array');
  if(value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))fail(field+' has invalid records');
  return value;
}
function id(value,field){
  if(typeof value!=='string'||!value.trim()||value.length>128)fail(field+' is not a saved identifier');
  return value;
}
function serial(value,field,allowZero=false){
  if(!Number.isSafeInteger(value)||(allowZero?value<0:value<=0))fail(field+' must be a safe positive permanent integer');
  return value;
}
function date(value,field){
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))fail(field+' has no valid saved timestamp');
  return value;
}
function unique(map,key,row,label){
  if(map.has(key))fail('duplicate '+label);
  map.set(key,row);
}

/** Pure lossless integrity preflight for an isolated, complete records snapshot.
 * Serial numbers are *never* recomputed from dates, IDs, row positions, or counts.
 *
 * Required snapshot identity tables match the SOURCE-ONLY SQL prototypes.
 * highWater includes sqlite_sequence to preserve ever-assigned values even
 * when historical deleted rows or gaps are present. Do not infer from MAX().
 */
export function validateNumberedIdentityArchive(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))fail('missing envelope');
  if(snapshot.format!==NUMBERED_IDENTITY_ARCHIVE_FORMAT||snapshot.version!==NUMBERED_IDENTITY_ARCHIVE_VERSION||
      snapshot.allTablesComplete!==true||snapshot.truncated!==false)
    fail('unverified archive format/version/completeness');
  const customers=rows(snapshot.customers,'customers');
  const estimates=rows(snapshot.estimates,'estimates');
  const numbers=rows(snapshot.fire_customer_numbers,'fire_customer_numbers');
  const jobs=rows(snapshot.fire_job_numbers,'fire_job_numbers');
  const links=rows(snapshot.fire_job_estimate_links,'fire_job_estimate_links');
  const customerIds=new Map(),estimateIds=new Map();
  for(const row of customers)unique(customerIds,id(row.id,'customer.id'),row,'customer id');
  for(const row of estimates){
    unique(estimateIds,id(row.id,'estimate.id'),row,'estimate id');
    if(!customerIds.has(id(row.customer_id,'estimate.customer_id')))
      fail('estimate belongs to an unknown customer');
  }
  const numbersByCustomer=new Map(),numbersBySerial=new Map();
  for(const row of numbers){
    const customer=id(row.customer_id,'number.customer_id');
    const number=serial(row.customer_number,'customer_number');
    date(row.created_at,'number.created_at');
    if(!customerIds.has(customer))fail('number maps to an unknown customer');
    unique(numbersByCustomer,customer,row,'numbered customer');
    unique(numbersBySerial,number,row,'customer serial');
    const original=customerIds.get(customer);
    if(typeof original.created_at==='string'&&original.created_at!==row.created_at)
      fail('customer number creation timestamp differs from saved customer');
  }
  if(numbersByCustomer.size!==customerIds.size)fail('incomplete customer numbering coverage');
  const jobsByNumber=new Map(),jobsByRoot=new Map();
  for(const row of jobs){
    const job=serial(row.job_number,'job_number');
    const root=id(row.root_estimate_id,'root_estimate_id');
    date(row.created_at,'job.created_at');
    if(!estimateIds.has(root))fail('job root estimate is missing');
    unique(jobsByNumber,job,row,'job serial');
    unique(jobsByRoot,root,row,'job root');
    const original=estimateIds.get(root);
    if(typeof original.created_at==='string'&&original.created_at!==row.created_at)
      fail('job number creation timestamp differs from its root estimate');
  }
  const linksByEstimate=new Map();
  for(const row of links){
    const estimate=id(row.estimate_id,'link.estimate_id');
    const number=serial(row.job_number,'link.job_number');
    if(!estimateIds.has(estimate))fail('job link points to missing estimate');
    const job=jobsByNumber.get(number);
    if(!job)fail('job link points to unknown job number');
    if(estimateIds.get(estimate).customer_id!==estimateIds.get(job.root_estimate_id).customer_id)
      fail('job number crosses different customers');
    unique(linksByEstimate,estimate,row,'job link for estimate');
  }
  if(linksByEstimate.size!==estimateIds.size)fail('incomplete job numbering coverage');
  for(const job of jobs){
    if(linksByEstimate.get(job.root_estimate_id)?.job_number!==job.job_number)
      fail('root estimate is not linked to its own permanent job number');
  }
  if(!snapshot.highWater||typeof snapshot.highWater!=='object'||Array.isArray(snapshot.highWater))
    fail('missing original SQLite AUTOINCREMENT high-water marks');
  const customerHigh=serial(snapshot.highWater.customer,'customer high-water mark',true);
  const jobHigh=serial(snapshot.highWater.job,'job high-water mark',true);
  // Do not spread unbounded record counts into Math.max (stack overflow).
  let maxCustomer=0,maxJob=0;
  for(const value of numbersBySerial.keys())if(value>maxCustomer)maxCustomer=value;
  for(const value of jobsByNumber.keys())if(value>maxJob)maxJob=value;
  if(customerHigh<maxCustomer||jobHigh<maxJob)fail('high-water mark would reuse an assigned number');
  return Object.freeze({
    customers:customerIds.size,estimates:estimateIds.size,
    customerNumbers:numbersBySerial.size,jobNumbers:jobsByNumber.size,
    jobLinks:linksByEstimate.size,customerHighWater:customerHigh,jobHighWater:jobHigh
  });
}
