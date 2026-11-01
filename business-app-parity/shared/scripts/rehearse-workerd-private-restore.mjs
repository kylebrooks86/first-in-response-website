/** FIRE DISPOSABLE LOCAL WORKERD DB+PHOTO RECOVERY REHEARSAL.
 *
 * Only import this file from the pinned local integration script. NOT from an
 * app route. Does not authenticate an owner or authorize a hosted restore.
 * Given independently materialized disposable workerd D1 and R2 targets, it
 * refuses nonempty/mismatched targets, decrypts + validates the complete
 * private kit, stages exact photo bytes in the EMPTY local R2 namespace, then
 * performs one D1 transactional batch containing ALL record and immutable
 * identity inserts. Any D1 failure rolls back that batch. It attempts photo
 * cleanup on an error, but D1 and R2 are not a shared atomic transaction.
 *
 * WARNING: the function intentionally WRITES to its supplied target bindings.
 * It must NEVER be called with hosted DBs/buckets or imported by FIRE runtime.
 */
import {openNumberedV2PrivateRecoveryKit}
 from '../lib/numbered-records-v2-private-kit.mjs';
import {captureFinanciallyVerifiedNumberedRecordsV2FromD1}
 from '../lib/numbered-records-v2-d1-read.mjs';
import {FIRE_NUMBERED_RECORDS_TABLES}
 from '../lib/numbered-records-v2.mjs';

const fail=reason=>{throw new Error('FIRE LOCAL WORKERD RESTORE REFUSED: '+reason);};
const TABLES=[...FIRE_NUMBERED_RECORDS_TABLES,
 'fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'];
const requireDb=db=>{
 if(!db||typeof db.batch!=='function'||typeof db.prepare!=='function')
  fail('disposable local D1 binding required');
};
const identifier=table=>'"'+table+'"';
async function rows(db,sql){
 const value=await db.prepare(sql).all();
 if(!Array.isArray(value?.results)||value.success!==true)
  fail('local D1 SQL inspection failed');
 return value.results;
}
async function schemaSignature(db){
 const all=await rows(db,"SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA','_cf_KV','d1_migrations') ORDER BY type,name");
 return JSON.stringify(all);
}
async function cleanTarget(db,bucket){
 for(const t of TABLES){
  const items=await rows(db,'SELECT COUNT(*) AS n FROM '+identifier(t));
  if(items.length!==1||items[0].n!==0)
   fail('target contains existing database records or numbered identities');
 }
 for(const n of ['fire_customer_numbers','fire_job_numbers']){
  const seq=await rows(db,"SELECT seq FROM sqlite_sequence WHERE name='"+n+"'");
  if(seq.length&&(seq.length!==1||seq[0].seq!==0))
   fail('target consumed permanent identifiers in prior history');
 }
 if(typeof bucket?.list!=='function'||typeof bucket?.put!=='function'||
    typeof bucket?.head!=='function'||typeof bucket?.get!=='function'||
    typeof bucket?.delete!=='function')
  fail('fully isolated empty photo bucket must support list/get/put/head/delete');
 const objects=await bucket.list({limit:1});
 if(objects?.objects?.length!==0||objects?.truncated!==false)
  fail('target photo bucket is nonempty or cannot prove emptiness');
}
async function dependencyOrder(db){
 const remaining=new Set(FIRE_NUMBERED_RECORDS_TABLES);
 const ordered=[];
 while(remaining.size){
  let progressed=false;
  for(const name of FIRE_NUMBERED_RECORDS_TABLES){
   if(!remaining.has(name))continue;
   const fks=await rows(db,'PRAGMA foreign_key_list('+identifier(name)+')');
   if(!fks.every(x=>!remaining.has(x.table)))continue;
   ordered.push(name);remaining.delete(name);progressed=true;
  }
  if(!progressed)fail('record schema has an unreviewed circular foreign key dependency');
 }
 return ordered;
}
function rowKeysExact(record,columns){
 const keys=Object.keys(record);
 return keys.length===columns.length&&
  [...keys].sort().join('|')===[...columns].sort().join('|');
}
async function buildBatch(db,archive){
 const statements=[];
 const order=await dependencyOrder(db);
 for(const table of order){
  const expected=await rows(db,'PRAGMA table_info('+identifier(table)+')');
  if(!expected.length)fail('missing required destination table');
  const cols=expected.map(x=>x.name);
  for(const original of archive.records.tables[table]){
   if(!original||typeof original!=='object'||Array.isArray(original)||
      !rowKeysExact(original,cols))fail('destination table columns drifted from original');
   const values=cols.map(key=>original[key]);
   if(values.some(v=>v!==null&&typeof v!=='string'&&
       !(typeof v==='number'&&Number.isFinite(v))))
    fail('record contains non-SQLite data type');
   statements.push(db.prepare('INSERT INTO '+identifier(table)+' ('+
      cols.map(identifier).join(',')+') VALUES ('+
      cols.map(()=>'?').join(',')+')').bind(...values));
  }
 }
 const id=archive.identities;
 for(const row of id.fire_customer_numbers)
  statements.push(db.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)')
   .bind(row.customer_number,row.customer_id,row.created_at));
 for(const row of id.fire_job_numbers)
  statements.push(db.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)')
   .bind(row.job_number,row.root_estimate_id,row.created_at));
 for(const row of id.fire_job_estimate_links)
  statements.push(db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)')
   .bind(row.estimate_id,row.job_number));
 for(const [name,seq] of [
   ['fire_customer_numbers',id.highWater.customer],
   ['fire_job_numbers',id.highWater.job]
 ]){
  // The source's sequence can be higher than max currently present because
  // deleted Customer/Job # values can NEVER be reused.
  if(seq>0){
   // sqlite_sequence.name is NOT constrained UNIQUE. REPLACE would create
   // two allocator rows; choose UPDATE after restored identity inserts.
   const count=name==='fire_customer_numbers'
    ?id.fire_customer_numbers.length:id.fire_job_numbers.length;
   if(count)statements.push(db.prepare(
    'UPDATE sqlite_sequence SET seq=? WHERE name=?').bind(seq,name));
   else statements.push(db.prepare(
    'INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').bind(name,seq));
  }
 }
 if(statements.length>1000)
  fail('recovery exceeds reviewed small-batch limit; never partially apply');
 return {statements,orderedTables:order.length};
}
async function verifyR2(bucket,photos){
 for(const f of photos){
  const got=await bucket.get(f.objectKey);
  if(!got||got.size!==f.bytes.byteLength||
     got.httpMetadata?.contentType!==f.contentType)
   fail('restored photo object missing or wrong metadata');
  const bytes=new Uint8Array(await got.arrayBuffer());
  if(bytes.length!==f.bytes.length||bytes.some((b,i)=>b!==f.bytes[i]))
   fail('restored original photo bytes differ');
 }
}
async function cleanup(bucket,keys){
 let success=true;
 for(const key of keys){
  try{await bucket.delete(key);}catch{success=false;}
 }
 return success;
}
/** One-shot recovery into two DIFFERENT, EMPTY workerd-local destinations.
 * The caller MUST independently pin remoteBindings:false, persist:false and
 * the placeholder resource IDs. This function is NOT a production restorer.
 */
export async function rehearseCompleteKitIntoDisposableWorkerd({
 sourceDb,targetDb,targetBucket,kit,passphrase,beforeAtomicBatch
}={}){
 requireDb(sourceDb);requireDb(targetDb);
 if(sourceDb===targetDb)fail('source and restore destinations must be independent');
 if(await schemaSignature(sourceDb)!==await schemaSignature(targetDb))
  fail('recovery schema differs from reviewed original migration schema');
 await cleanTarget(targetDb,targetBucket);
 const {archive,photos}=await openNumberedV2PrivateRecoveryKit({kit,passphrase});
 const {statements,orderedTables}=await buildBatch(targetDb,archive);
 const staged=[];
 let committed=false;
 try{
  for(const photo of photos){
   if(await targetBucket.head(photo.objectKey))
    fail('original photo object already exists in recovery bucket');
   await targetBucket.put(photo.objectKey,photo.bytes,{
    httpMetadata:{contentType:photo.contentType}
   });
   staged.push(photo.objectKey);
  }
  await verifyR2(targetBucket,photos);
  // Dedicated local-only fault injection proves D1 batch rollback even after
  // all R2 bytes were staged. Not exposed in any application route.
  if(beforeAtomicBatch)await beforeAtomicBatch(targetDb);
  if(statements.length) {
   const result=await targetDb.batch(statements);
   if(!Array.isArray(result)||result.length!==statements.length||
      result.some(x=>x.success!==true))
    fail('atomic recovery D1 batch was incomplete');
  }
  committed=true;
  const recovered=await captureFinanciallyVerifiedNumberedRecordsV2FromD1({
   db:targetDb,now:()=>archive.records.exportedAt
  });
  if(recovered.archive.checksum.hex!==archive.checksum.hex)
   fail('database restore is not an exact original 21-table/numbering replay');
  const fk=await rows(targetDb,'PRAGMA foreign_key_check');
  if(fk.length)fail('recovered local D1 foreign keys are inconsistent');
  const integrity=await rows(targetDb,'PRAGMA integrity_check');
  if(integrity.length!==1||integrity[0].integrity_check!=='ok')
   fail('recovered local SQLite integrity check failed');
  await verifyR2(targetBucket,photos);
  return Object.freeze({
   reviewedRecordTables:orderedTables,reviewedNumberedTables:3,
   photosRestored:photos.length,originalNumberHighWaterPreserved:true,
   verifiedOriginalDatabaseChecksum:true,verifiedOriginalPhotoBytes:true,
   restoredOnlyToDisposableWorkerd:true,realHostedRestorePerformed:false,
   independentD1R2AtomicCommitGuaranteed:false,productionReleaseApproved:false
  });
 }catch{
  // On an uncommitted D1 failure, Cloudflare D1 batch guarantees rollback.
  // Best-effort cleanup is allowed only here, in throwaway local R2.
  const cleaned=await cleanup(targetBucket,staged);
  if(!cleaned)fail('cleanup incomplete; discard entire disposable recovery environment');
  fail(committed?'postcommit verification failed; throw away disposable recovery target':
    'transaction or original photo staging failed; discard disposable recovery target');
 }
}
