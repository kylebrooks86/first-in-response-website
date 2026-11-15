/**
 * FIRE NEW LIVE owner-only postlock physical evidence custody, NO REMOTE OPS.
 * Three already-created immutable local records are authenticated, bound to
 * their physical NEW LIVE identity, AES-256-GCM encrypted and reopened from disk.
 * Never reads Cloudflare, launches Wrangler, runs SQL, changes locks or uploads.
 *
 * node owner_new_live_postlock_encrypted_custody.mjs backup NEW.fireliveproof
 * node owner_new_live_postlock_encrypted_custody.mjs verify EXISTING.fireliveproof
 * Passphrase is prompted without echo and must not be placed in shell arguments.
 */
import {createCipheriv,createDecipheriv,createHash,pbkdf2Sync,randomBytes} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const MAGIC=Buffer.from('FIRELV01','ascii');
const LIVE='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const DB='fire-fullapp-new-live-db';
const SOURCE='9fcffa883284ca7eb50684ba833ab4475130971b';
const ITER=600000, HEADER=44, TAG=16, MAX=128*1024;
const folder=join(homedir(),'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114');
const NAMES=Object.freeze([
 'new-live-remote-attempt-lock.json',
 'new-live-postlock-recovery-attempt-lock.json',
 'new-live-postlock-recovery-physical-receipt.json'
]);
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=m=>{throw Error('FIRE LIVE PRIVATE CUSTODY STOP: '+m)};
function object(x){return x&&typeof x==='object'&&!Array.isArray(x)}
function parse(bytes){try{const v=JSON.parse(bytes.toString('utf8'));if(!object(v))fail('invalid evidence JSON');return v}catch{fail('invalid evidence JSON')}}
function readOwnerEvidence(name){
 if(!NAMES.includes(name))fail('unreviewed evidence filename');
 const f=join(folder,name);
 if(!existsSync(f))fail('missing accepted receipt or lock: '+name);
 const st=lstatSync(f);
 if(!st.isFile()||st.isSymbolicLink()||st.size<2||st.size>20000)fail('unreviewed evidence file type/size');
 return readFileSync(f);
}
export function verifyPhysicalLiveEvidence(entries){
 if(!Array.isArray(entries)||entries.length!==3||new Set(entries.map(e=>e?.name)).size!==3||
  entries.some(e=>!NAMES.includes(e?.name)||!Buffer.isBuffer(e?.bytes)||e.bytes.length<2||e.bytes.length>20000))
  fail('must contain exactly the three original preserved LIVE files');
 const files=new Map(entries.map(e=>[e.name,e.bytes]));
 const old=files.get(NAMES[0]),next=files.get(NAMES[1]),receipt=files.get(NAMES[2]);
 const a=parse(old),b=parse(next),c=parse(receipt);
 if(a.target!=='independent-live'||a.database_name!==DB||a.database_id!==LIVE||
  a.state!=='REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY'||
  a.sourceMigrationCount!==26||a.physicalIdentityConfirmed!==true||a.initialApplicationTables!==0||
  typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt)))
  fail('original lock does not match preserved NEW LIVE original-attempt evidence');
 if(b.operation!=='NEW_POSTLOCK_26_SQL_RESCUE_ONE_SHOT'||
  b.target!=='independent-live'||b.database_name!==DB||b.database_id!==LIVE||
  b.state!=='NEW_REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_RETRY'||
  b.sourceMigrationCount!==26||b.oldAttemptLockSha256!==sha(old)||
  b.oldAttemptLockPreserved!==true||b.priorCommandResultAttested!==false||
  b.newRemoteWriteResultAttested!==false||b.gate5Accepted!==false||b.productionReady!==false)
  fail('separate recovery lock does not bind the original owner lock');
 if(c.operation!=='NEW_POSTLOCK_26_SQL_RESCUE_ONE_SHOT'||
  c.databaseName!==DB||c.physicalDatabaseId!==LIVE||
  c.originalAttemptLockSha256!==sha(old)||c.originalLockPreserved!==true||
  c.originalFailedOrUnknownAttemptAcknowledged!==false||
  c.separateNewRemoteMigrationCommandReturnedSuccess!==true||
  c.appliedMigrationRowsVerified!==26||c.exactSourceSchemaAndFinancialIndexesVerified!==true||
  c.firstFutureJobExpected!=='0001'||c.firstFutureCustomerExpected!=='0001'||
  c.operationalCustomerJobRecordsAbsent!==true||
  !Number.isInteger(c.readOnlyValidationStatements)||c.readOnlyValidationStatements<1||
  c.postWriteLivePhysicalIdentityRetested!==true||
  c.bothOriginalAndRecoveryLocksUnchanged!==true||c.recoveryLockPreserved!==true||
  c.ownerAuthActivated!==false||c.workerCreatedOrDeployed!==false||
  c.noStripePaymentChanges!==true||c.noR2OrPaidCloudflare!==true||
  c.gate4Accepted!==false||c.gate5Accepted!==false||c.gate7Accepted!==false||
  c.productionReady!==false||c.liveActivationAuthorized!==false||
  typeof c.checkedAt!=='string'||!Number.isFinite(Date.parse(c.checkedAt)))
  fail('postlock physical receipt is missing a required successful readback or falsely claims LIVE');
 return Object.freeze({exactFiles:3,physicalD1:LIVE,reviewedMigrations:26,
  firstFutureJob:'0001',ownerAuthActivated:false,liveDeployed:false,gate5Accepted:false});
}
export function encryptOwnerEvidence(entries,phrase){
 verifyPhysicalLiveEvidence(entries);
 const payload=Buffer.from(JSON.stringify({kind:'FIRE_NEW_LIVE_POSTLOCK_OWNER_CUSTODY_V1',sourceSha:SOURCE,
  files:entries.map(e=>({name:e.name,sha256:sha(e.bytes),data:e.bytes.toString('base64')}))}),'utf8');
 if(payload.length>MAX)fail('evidence exceeds size cap');
 const keyphrase=validatePhrase(phrase),h=Buffer.alloc(HEADER);
 MAGIC.copy(h,0);randomBytes(16).copy(h,8);randomBytes(12).copy(h,24);
 h.writeUInt32LE(ITER,36);h.writeUInt32LE(payload.length,40);
 const key=pbkdf2Sync(keyphrase,h.subarray(8,24),ITER,32,'sha256');
 try{
  const cipher=createCipheriv('aes-256-gcm',key,h.subarray(24,36));cipher.setAAD(h);
  return Buffer.concat([h,cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
 }finally{key.fill(0)}
}
function validatePhrase(phrase){
 if(typeof phrase!=='string'||phrase.length<16||phrase.length>1024)
  fail('use a private passphrase of at least 16 characters');
 return Buffer.from(phrase,'utf8');
}
export function decryptOwnerEvidence(archive,phrase){
 if(!Buffer.isBuffer(archive)||archive.length<=HEADER+TAG||archive.length>MAX+HEADER+TAG||
  !archive.subarray(0,8).equals(MAGIC)||archive.readUInt32LE(36)!==ITER||
  archive.readUInt32LE(40)!==archive.length-HEADER-TAG)
  fail('unsupported, truncated or oversized protected evidence');
 const key=pbkdf2Sync(validatePhrase(phrase),archive.subarray(8,24),ITER,32,'sha256');
 let plain;
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,archive.subarray(24,36));
  decipher.setAAD(archive.subarray(0,HEADER));decipher.setAuthTag(archive.subarray(-TAG));
  plain=Buffer.concat([decipher.update(archive.subarray(HEADER,-TAG)),decipher.final()]);
 }catch{fail('wrong passphrase or damaged ciphertext')}
 finally{key.fill(0)}
 const decoded=parse(plain);
 if(decoded.kind!=='FIRE_NEW_LIVE_POSTLOCK_OWNER_CUSTODY_V1'||decoded.sourceSha!==SOURCE||
  !Array.isArray(decoded.files)||decoded.files.length!==3)fail('wrong source or owner custody archive');
 const entries=decoded.files.map(e=>{
  if(!NAMES.includes(e?.name)||typeof e?.data!=='string'||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(e.data))
   fail('invalid archived file name or bytes');
  const bytes=Buffer.from(e.data,'base64');
  if(sha(bytes)!==e.sha256)fail('archive file hash mismatch');
  return {name:e.name,bytes};
 });
 verifyPhysicalLiveEvidence(entries);
 return entries;
}
function hiddenPhrase(prompt){
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')
  fail('run from owner interactive PowerShell, never pipe/pass a password');
 return new Promise((done,reject)=>{
  let s='';process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
  const handle=chunk=>{
   for(const b of chunk){if(b===3){finish(Error('owner cancelled'));return}
    if(b===13||b===10){finish();return}
    if(b===8||b===127){s=s.slice(0,-1);continue}
    if(b>=32&&b<127&&s.length<1024)s+=String.fromCharCode(b);
   }
  };
  function finish(err){process.stdin.off('data',handle);process.stdin.setRawMode(false);process.stdin.pause();
   process.stdout.write('\n');if(err)reject(err);else done(s)}
  process.stdin.on('data',handle);
 });
}
async function main(){
 const [mode,name,...extra]=process.argv.slice(2);
 if(extra.length||!['backup','verify'].includes(mode)||typeof name!=='string')
  fail('use: backup NEW.fireliveproof | verify EXISTING.fireliveproof');
 const path=resolve(name);
 if(!path.endsWith('.fireliveproof'))fail('protected output must have .fireliveproof extension');
 if(mode==='backup'){
  if(existsSync(path))fail('output exists: never overwrite an existing encrypted backup');
  if(!existsSync(dirname(path))||lstatSync(dirname(path)).isSymbolicLink())fail('output directory missing or linked');
  const inputs=NAMES.map(name=>({name,bytes:readOwnerEvidence(name)}));
  verifyPhysicalLiveEvidence(inputs);
  const pass=await hiddenPhrase('NEW LIVE private backup passphrase (hidden): ');
  const again=await hiddenPhrase('Confirm passphrase (hidden): ');
  if(pass!==again)fail('passphrase confirmation differs; nothing written');
  const data=encryptOwnerEvidence(inputs,pass);
  writeFileSync(path,data,{flag:'wx',mode:0o600});
  const fileReadback=readFileSync(path),recovered=decryptOwnerEvidence(fileReadback,pass);
  if(recovered.length!==3||recovered.some(e=>!e.bytes.equals(inputs.find(x=>x.name===e.name).bytes)))
   fail('saved ciphertext reopened but evidence did not match original bytes');
  console.log('FIRE LIVE EVIDENCE: 3/3 owner files AES-256-GCM encrypted, saved and independently reopened.');
  console.log('Protected backup SHA256 '+sha(fileReadback));
  console.log('Copy ONLY .fireliveproof (not original JSON locks/receipts) to owner-private Google Drive.');
  console.log('No Cloudflare, D1, SQL, Worker, Stripe, paid R2, GitHub or other provider action.');
 }else{
  if(!existsSync(path)||!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())
   fail('existing private backup not found or unsafe file type');
  const pass=await hiddenPhrase('NEW LIVE private backup passphrase (hidden): ');
  const recovered=decryptOwnerEvidence(readFileSync(path),pass);
  console.log('FIRE LIVE EVIDENCE VERIFIED: '+recovered.length+'/3 protected files intact, no plaintext restored.');
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main()}catch(e){console.error(String(e.message));process.exitCode=1}
}
