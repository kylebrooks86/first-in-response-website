/**
 * FIRE DR release evidence: encrypted owner-held backup of the ALREADY
 * ACCEPTED physical migration receipts + the offline Worker review.
 * No network, D1 writes, Cloudflare, Stripe, R2 or paid subscription.
 * Filenames, database ID, SQL and receipts are INSIDE AES-GCM ciphertext.
 */
import {createCipheriv,createDecipheriv,createHash,pbkdf2Sync,randomBytes,timingSafeEqual} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';

const MAGIC=Buffer.from('FIREDR01','ascii'),ITERATIONS=600000;
const HEADER_SIZE=44,TAG_SIZE=16,MAX_INPUT=8*1024*1024,MAX_ARCHIVE=8*1024*1024;
const DR_ID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const stop=why=>{throw Error('FIRE DR protected evidence BLOCKED: '+why);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowedName=path=>path==='owner/remote-one-shot-attempt.json'||
 path==='owner/dr-physical-schema-receipt.json'||
 path==='review/dr-compiled-physical-postinstall-reviewed.json'||
 ['READ_ME_FIRST.txt','source-hashes.json','wrangler.json'].some(n=>path==='workspace/'+n)||
 /^workspace\/migrations\/\d{4}_[a-z0-9_]+\.sql$/.test(path);
const needNameSet=files=>{
 const names=files.map(x=>x.path).sort();
 const fixed=['owner/remote-one-shot-attempt.json','owner/dr-physical-schema-receipt.json',
  'review/dr-compiled-physical-postinstall-reviewed.json',
  'workspace/READ_ME_FIRST.txt','workspace/source-hashes.json','workspace/wrangler.json'];
 if(files.length!==32||new Set(names).size!==32||
    fixed.some(n=>!names.includes(n))||
    files.filter(x=>x.path.startsWith('workspace/migrations/')).length!==26||
    names.some(n=>!allowedName(n)))
  stop('must contain precisely 32 reviewed DR evidence files (26 original SQL + 6 receipts/configs)');
 for(let i=0;i<26;i++){
  if(!names.some(n=>n.startsWith('workspace/migrations/'+String(i).padStart(4,'0')+'_')))
   stop('missing an ordered source migration '+i);
 }
};
const readItem=(files,name)=>{
 let bytes;
 try{bytes=Buffer.from(files.find(f=>f.path===name).bytes,'base64');}
 catch{stop('required owner evidence '+name+' not readable');}
 try{return JSON.parse(bytes.toString('utf8'))}
 catch{stop('required JSON evidence malformed: '+name);}
};
function verifySemanticEvidence(files){
 const lock=readItem(files,'owner/remote-one-shot-attempt.json');
 const rec=readItem(files,'owner/dr-physical-schema-receipt.json');
 const review=readItem(files,'review/dr-compiled-physical-postinstall-reviewed.json');
 if(lock.target!=='independent-dr'||lock.uuid!==DR_ID||lock.migrationCount!==26||
   rec.target!=='independent-dr'||rec.uuid!==DR_ID||rec.migrationCount!==26||
   rec.physicalDRReadbackVerified!==true||rec.remoteCommandReturnedSuccess!==true||
   rec.firstJobExpectedInCleanDR!=='0001'||
   review.sourceEvidence?.state!=='DR_PHYSICAL_SCHEMA_ACCEPTED__WORKER_NOT_DEPLOYED'||
   review.sourceEvidence?.databaseId!==DR_ID||
   review.sourceEvidence?.reviewedMigrationCount!==26||
   review.sourceEvidence?.drWorkerDeployed!==false||
   review.sourceEvidence?.ownerApprovedDeployment!==false||
   review.config?.d1_databases?.[0]?.database_id!==DR_ID||
   review.config?.vars?.FIRE_DR_AUTH_ENABLED!=='blocked'||
   review.config?.r2_buckets?.length!==0)
  stop('accepted DR receipt or offline Worker review identity/safety inconsistent');
 const actualOwner=sha(Buffer.from(files.find(f=>f.path==='owner/remote-one-shot-attempt.json').bytes,'base64'));
 const actualReceipt=sha(Buffer.from(files.find(f=>f.path==='owner/dr-physical-schema-receipt.json').bytes,'base64'));
 if(review.sourceEvidence?.existingOwnerAttemptSha256!==actualOwner||
    review.sourceEvidence?.existingOwnerReceiptSha256!==actualReceipt)
  stop('DR reviewed output does not cryptographically bind these owner receipts');
 const journal=readItem(files,'workspace/source-hashes.json');
 if(journal.target!=='independent-dr'||journal.database_id!==DR_ID||
   journal.migrationCount!==26||!Array.isArray(journal.migrations)||journal.migrations.length!==26)
  stop('migration receipt scope not reviewed');
 const sql=files.filter(x=>x.path.startsWith('workspace/migrations/'));
 for(const entry of journal.migrations){
  const file=sql.find(x=>x.path==='workspace/migrations/'+entry.filename);
  if(!file||entry.sha256!==sha(Buffer.from(file.bytes,'base64')))
   stop('original SQL bytes do not match the saved migration manifest');
 }
 const config=readItem(files,'workspace/wrangler.json');
 if(config.d1_databases?.length!==1||config.d1_databases[0].binding!=='DB'||
    config.d1_databases[0].database_id!==DR_ID)
  stop('saved workspace binding is not original DR');
}
export function validateDREvidenceEntries(entries){
 if(!Array.isArray(entries))stop('evidence file list required');
 const files=entries.map(entry=>{
  if(!entry||typeof entry.path!=='string'||!allowedName(entry.path)||
    !(entry.bytes instanceof Uint8Array)||entry.bytes.length<1||entry.bytes.length>1024*1024)
   stop('unreviewed file, path or evidence size');
  return {path:entry.path,sha256:sha(entry.bytes),bytes:Buffer.from(entry.bytes).toString('base64')};
 }).sort((a,b)=>a.path.localeCompare(b.path,'en'));
 needNameSet(files);
 verifySemanticEvidence(files);
 const encoded=Buffer.from(JSON.stringify({kind:'FIRE_PRIVATE_DR_PHYSICAL_EVIDENCE_V1',
  source:'owner-already-accepted-dr-physical-and-inert-worker-receipts',files}),'utf8');
 if(encoded.length>MAX_INPUT)stop('private release evidence too large');
 return encoded;
}
function readContents(plain){
 let value;
 try{value=JSON.parse(plain.toString('utf8'))}catch{stop('decrypted evidence format invalid');}
 if(value?.kind!=='FIRE_PRIVATE_DR_PHYSICAL_EVIDENCE_V1'||
    value.source!=='owner-already-accepted-dr-physical-and-inert-worker-receipts'||
    !Array.isArray(value.files))stop('not this exact DR receipt backup');
 const entries=value.files.map(f=>{
  if(typeof f?.bytes!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.bytes))
   stop('invalid encrypted evidence bytes');
  const bytes=Buffer.from(f.bytes,'base64');
  if(f.sha256!==sha(bytes))stop('decrypted evidence SHA mismatch');
  return {path:f.path,bytes};
 });
 validateDREvidenceEntries(entries);
 return entries;
}
function derive(phrase,salt){
 if(typeof phrase!=='string'||phrase.length<16||phrase.length>1024)
  stop('use a private 16–1024-character passphrase; never place it in commands');
 return pbkdf2Sync(Buffer.from(phrase,'utf8'),salt,ITERATIONS,32,'sha256');
}
export function encryptDREvidenceEntries(entries,phrase){
 const plain=validateDREvidenceEntries(entries);
 const compressed=deflateRawSync(plain,{level:9});
 if(compressed.length>MAX_ARCHIVE)stop('evidence too large');
 const header=Buffer.alloc(HEADER_SIZE);
 MAGIC.copy(header,0);randomBytes(16).copy(header,8);randomBytes(12).copy(header,24);
 header.writeUInt32LE(ITERATIONS,36);header.writeUInt32LE(compressed.length,40);
 const key=derive(phrase,header.subarray(8,24));
 try{
  const cipher=createCipheriv('aes-256-gcm',key,header.subarray(24,36));
  cipher.setAAD(header);
  const data=Buffer.concat([cipher.update(compressed),cipher.final()]);
  return Buffer.concat([header,data,cipher.getAuthTag()]);
 }finally{key.fill(0);}
}
export function decryptDREvidenceArchive(archive,phrase){
 const source=Buffer.from(archive);
 if(source.length<=HEADER_SIZE+TAG_SIZE||source.length>MAX_ARCHIVE+HEADER_SIZE+TAG_SIZE||
    !timingSafeEqual(source.subarray(0,8),MAGIC)||
    source.readUInt32LE(36)!==ITERATIONS||
    source.readUInt32LE(40)!==source.length-HEADER_SIZE-TAG_SIZE)
  stop('not an intact supported FIRE protected DR evidence file');
 const key=derive(phrase,source.subarray(8,24));
 let compressed;
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,source.subarray(24,36));
  decipher.setAAD(source.subarray(0,HEADER_SIZE));
  decipher.setAuthTag(source.subarray(-TAG_SIZE));
  compressed=Buffer.concat([decipher.update(source.subarray(HEADER_SIZE,-TAG_SIZE)),decipher.final()]);
 }catch{stop('wrong passphrase or damaged protected DR evidence; no files restored');}
 finally{key.fill(0);}
 let plain;
 try{plain=inflateRawSync(compressed,{maxOutputLength:MAX_INPUT});}
 catch{stop('decompressed DR receipt format exceeds safety limits');}
 return readContents(plain);
}
