/** FIRE complete SQLite business-records backup as a PRIVATE ENCRYPTED file.
 * No paid cloud, R2, provider access, customer upload, database migration,
 * plain JSON intermediate file, remote calls, or production restore.
 *
 * Source is an ALREADY OBTAINED standalone LOCAL SQLite snapshot (not .sql).
 * The encrypted .firerecords is opaque, AES-256-GCM authenticated, with
 * 600,000-iteration PBKDF2-SHA256 and independent random salt and IV.
 * Both complete numbered-core and supplemental archives, the exact schema
 * identity, permanent serial history and applied D1 journal are sealed in ONE
 * indivisible ciphertext. Decrypted JSON is NEVER persisted to disk.
 *
 * CLI, non-echoing stdin phrase (never args):
 * node --experimental-sqlite protected_complete_isolated_sqlite_recovery.mjs \
 *    seal SOURCE.sqlite SAVED.firerecords
 * node --experimental-sqlite protected_complete_isolated_sqlite_recovery.mjs \
 *    restore SAVED.firerecords EMPTY_MIGRATED.sqlite RESTORED.sqlite
 *
 * Outputs are created exclusively and NEVER overwrite. Keep private original
 * SQLite backup and protected photo .firephotos as separately secured assets.
 */
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,pbkdf2,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {open,readFile,stat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureCompleteIsolatedSqliteSnapshot} from './export_complete_isolated_sqlite_snapshot.mjs';
import {restoreNumberedRecordsToIsolatedSqliteFromArchives} from './restore_numbered_records_to_isolated_sqlite.mjs';
import {validateNumberedCoreRecordsV2} from './shared/lib/numbered-records-v2-preflight.mjs';
import {validateSupplementalRecoveryArchive} from './validate_supplemental_recovery_archive.mjs';
const pbkdf2Async=promisify(pbkdf2);
const MAGIC=Buffer.from('FIRERB01','ascii');
const HEADER_BYTES=48,TAG_BYTES=16,KDF_ITERATIONS=600000;
const MAX_CORE=64*1024*1024,MAX_EXTRA=48*1024*1024;
const MAX_ENCRYPTED=HEADER_BYTES+TAG_BYTES+MAX_CORE+MAX_EXTRA;
const stop=why=>{throw Error('FIRE private complete-record recovery BLOCKED: '+why);};
const sha=data=>createHash('sha256').update(data).digest('hex');
const pathValue=x=>typeof x==='string'&&x.length>0;
const validPhrase=x=>typeof x==='string'&&x.length>=16&&x.length<=1024&&
 Buffer.byteLength(x,'utf8')<=4096;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function assertCompletePair(core,extra){
 const proof=validateNumberedCoreRecordsV2(core);
 if(!isRecord(extra)||!isRecord(core?.schemaIdentity)||!isRecord(extra?.schemaIdentity)||
    JSON.stringify(core.schemaIdentity)!==JSON.stringify(extra.schemaIdentity))
  stop('numbered and supplemental records do not share the same source schema identity');
 const extraTables=Object.keys(extra.tables||{});
 const checked=validateSupplementalRecoveryArchive(extra,extraTables);
 return {customers:proof.customers,jobs:proof.jobNumbers,
  coreRows:proof.coreRows,extraRows:checked.rows,
  schemaSha256:core.schemaIdentity.sha256};
}
async function secretKey(phrase,salt){
 if(!validPhrase(phrase))stop('a private passphrase of 16–1024 characters is required');
 const password=Buffer.from(phrase,'utf8');
 try{return await pbkdf2Async(password,salt,KDF_ITERATIONS,32,'sha256');}
 finally{password.fill(0);}
}
function serialize(core,supplemental){
 const coreJson=Buffer.from(JSON.stringify(core),'utf8');
 const extraJson=Buffer.from(JSON.stringify(supplemental),'utf8');
 if(!coreJson.length||!extraJson.length||coreJson.length>MAX_CORE||
    extraJson.length>MAX_EXTRA){
  coreJson.fill(0);extraJson.fill(0);
  stop('complete snapshot exceeds safe archive limit; no partial export');
 }
 return [coreJson,extraJson];
}
async function encryptSnapshot(core,supplemental,phrase){
 const proof=assertCompletePair(core,supplemental);
 const [coreJson,extraJson]=serialize(core,supplemental);
 const header=Buffer.alloc(HEADER_BYTES);
 MAGIC.copy(header);
 randomBytes(16).copy(header,8);
 randomBytes(12).copy(header,24);
 header.writeUInt32LE(coreJson.length,36);
 header.writeUInt32LE(extraJson.length,40);
 header.writeUInt32LE(KDF_ITERATIONS,44);
 let key,plain;
 try{
  key=await secretKey(phrase,header.subarray(8,24));
  plain=Buffer.concat([coreJson,extraJson]);
  const cipher=createCipheriv('aes-256-gcm',key,header.subarray(24,36));
  cipher.setAAD(header);
  const encoded=Buffer.concat([cipher.update(plain),cipher.final()]);
  const tag=cipher.getAuthTag();
  return {file:Buffer.concat([header,encoded,tag]),proof};
 }finally{
  coreJson.fill(0);extraJson.fill(0);
  if(plain)plain.fill(0);
  if(key)key.fill(0);
 }
}
async function decryptSnapshot(buffer,phrase){
 if(!Buffer.isBuffer(buffer)||buffer.length<HEADER_BYTES+TAG_BYTES+2||
    buffer.length>MAX_ENCRYPTED||!buffer.subarray(0,8).equals(MAGIC))
  stop('missing, truncated or unsupported encrypted records backup');
 const header=buffer.subarray(0,HEADER_BYTES);
 const coreSize=header.readUInt32LE(36),extraSize=header.readUInt32LE(40);
 if(header.readUInt32LE(44)!==KDF_ITERATIONS||
    coreSize<1||extraSize<1||coreSize>MAX_CORE||extraSize>MAX_EXTRA||
    buffer.length!==HEADER_BYTES+coreSize+extraSize+TAG_BYTES)
  stop('encrypted records lengths or protected KDF metadata are invalid');
 let key,decoded;
 try{
  key=await secretKey(phrase,header.subarray(8,24));
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(24,36));
  decipher.setAAD(header);
  decipher.setAuthTag(buffer.subarray(buffer.length-TAG_BYTES));
  decoded=Buffer.concat([
   decipher.update(buffer.subarray(HEADER_BYTES,buffer.length-TAG_BYTES)),
   decipher.final()
  ]);
  if(decoded.length!==coreSize+extraSize)stop('authenticated record length mismatch');
  const utf8=new TextDecoder('utf-8',{fatal:true});
  const core=JSON.parse(utf8.decode(decoded.subarray(0,coreSize)));
  const supplemental=JSON.parse(utf8.decode(decoded.subarray(coreSize)));
  const proof=assertCompletePair(core,supplemental);
  return {core,supplemental,proof};
 }catch{
  stop('wrong recovery phrase, damaged archive, or incomplete records; nothing restored');
 }finally{
  if(decoded)decoded.fill(0);
  if(key)key.fill(0);
 }
}
export async function inspectSavedProtectedCompleteRecords(path,phrase){
 if(!pathValue(path))stop('saved protected records file required');
 let file;
 try{
  const st=await stat(resolve(path));
  if(!st.isFile()||st.size<HEADER_BYTES+TAG_BYTES+2||st.size>MAX_ENCRYPTED)
   stop('saved protected file size unsupported');
  file=await readFile(resolve(path));
  if(file.length!==st.size)stop('saved file changed while reading');
 }catch{
  stop('saved protected records file missing or unsupported');
 }
 const opened=await decryptSnapshot(file,phrase);
 return {...opened,
  protectedFileSha256:sha(file),savedEncryptedFileReadBack:true};
}
export async function sealCompleteIsolatedSqliteSnapshot(source,output,phrase){
 if(!pathValue(source)||!pathValue(output)||resolve(source)===resolve(output))
  stop('source SQLite and new protected backup paths must be different');
 if(!validPhrase(phrase))stop('a private passphrase of 16–1024 characters is required');
 let db,handle,created=false;
 try{
  const st=await stat(resolve(source));
  if(!st.isFile()||st.size<100||st.size>1024*1024*1024)
   stop('source must be a standalone local SQLite snapshot');
  db=new DatabaseSync(resolve(source),{readOnly:true});
  if(db.prepare('PRAGMA journal_mode').get().journal_mode==='wal')
   stop('WAL-backed source requires an independently checkpointed SQLite snapshot');
  const snap=captureCompleteIsolatedSqliteSnapshot(db);
  db.close();db=undefined;
  const encrypted=await encryptSnapshot(snap.core,snap.supplemental,phrase);
  handle=await open(resolve(output),'wx',0o600);
  created=true;
  await handle.writeFile(encrypted.file);
  await handle.sync();
  await handle.close();handle=undefined;
  const reread=await inspectSavedProtectedCompleteRecords(output,phrase);
  if(reread.protectedFileSha256!==sha(encrypted.file)||
     reread.proof.schemaSha256!==encrypted.proof.schemaSha256||
     reread.proof.coreRows!==encrypted.proof.coreRows||
     reread.proof.extraRows!==encrypted.proof.extraRows)
   stop('saved encrypted file differs from captured complete snapshot');
  return Object.freeze({
   savedEncryptedFileReadBack:true,encryptedRecordsArchiveCreated:true,
   ...encrypted.proof,protectedFileSha256:reread.protectedFileSha256,
   plaintextJsonFilesWritten:false,remoteWritesPerformed:false,
   offDeviceCustodyVerified:false,photosIncluded:false,
   hostedD1RestoreVerified:false,gate7Accepted:false
  });
 }catch(error){
  if(db)try{db.close();}catch{}
  if(handle)try{await handle.close();}catch{}
  if(created)await unlink(resolve(output)).catch(()=>{});
  throw error;
 }
}
export async function restoreSavedProtectedCompleteRecords(protectedPath,templatePath,outputPath,phrase){
 if(![protectedPath,templatePath,outputPath].every(pathValue)||
    new Set([protectedPath,templatePath,outputPath].map(p=>resolve(p))).size!==3)
  stop('three separate protected/source-schema/new-output paths required');
 const opened=await inspectSavedProtectedCompleteRecords(protectedPath,phrase);
 const recovered=await restoreNumberedRecordsToIsolatedSqliteFromArchives(
  opened.core,templatePath,outputPath,opened.supplemental);
 return Object.freeze({
  ...recovered,savedEncryptedFileReadBack:true,
  protectedSourceSha256:opened.protectedFileSha256,
  plaintextJsonFilesWritten:false,protectedSourceUnmodified:true,
  photosRestored:false,hostedD1RestoreVerified:false,
  gate7Accepted:false
 });
}
async function readPhrase(){
 if(process.stdin.isTTY)stop('pipe the secret from a non-echoing prompt or protected input; never a CLI argument');
 let s='',size=0;
 for await(const chunk of process.stdin){
  size+=chunk.length;
  if(size>4096)stop('passphrase input too long');
  s+=chunk.toString('utf8');
 }
 s=s.replace(/\r?\n$/,'');
 if(!validPhrase(s))stop('a private 16–1024-character recovery phrase is required');
 return s;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  const command=process.argv[2],phrase=await readPhrase();
  if(command==='seal'&&process.argv.length===5)
   console.log(JSON.stringify(await sealCompleteIsolatedSqliteSnapshot(
    process.argv[3],process.argv[4],phrase)));
  else if(command==='restore'&&process.argv.length===6)
   console.log(JSON.stringify(await restoreSavedProtectedCompleteRecords(
    process.argv[3],process.argv[4],process.argv[5],phrase)));
  else stop('usage: seal SOURCE.sqlite SAVED.firerecords or restore SAVED.firerecords EMPTY.sqlite RESTORED.sqlite; phrase on stdin');
 }catch{
  // Do not echo paths, passphrase, customer data or SQLite errors to a log.
  console.error('FIRE protected full-record operation BLOCKED; no hosted resources changed.');
  process.exitCode=1;
 }
}
