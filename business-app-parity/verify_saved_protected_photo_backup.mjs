/** FIRE Gate 7 owner-held protected photo backup verifier (OFFLINE, READ-ONLY).
 * Node 22+; no network, Wrangler, remote DB, sync, migration, restoration,
 * file creation, credential storage or external packages.
 *
 * Pipe the recovery phrase via stdin (never as a command-line argument).
 * Do not run from a terminal that echoes typed secrets.
 * node verify_saved_protected_photo_backup.mjs "owner-saved.firephotos"
 *
 * Independently validates exact FIRE stored ZIP directory + descriptor +
 * CRC32 + every original SHA-256, after AES-GCM authenticates every chunk.
 * The file is opened from disk, not a prepared in-memory download.
 * All decrypted bytes remain in process memory and are not written to disk.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recoverProtectedOfflinePhotoZip,isProtectedOfflinePhotoArchive} from './shared/lib/protected-offline-photo-archive.mjs';

const MAX_ARCHIVE=161*1024*1024,MAX_PHOTOS=500,MAX_PHOTO=15*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
const fail=why=>{throw Error('FIRE saved photo recovery review BLOCKED: '+why);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(value);
const safeCustomer=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(value);
const photoTypes=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/bmp']);
const table=Array.from({length:256},(_,n)=>{
 let c=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;
});
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes)c=table[(c^b)&255]^(c>>>8);
 return (c^0xffffffff)>>>0;
}
function validPhoto(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).sort().join(',')!=='caption,category,contentType,createdAt,customerId,filename,id,sha256,sizeBytes')
  return false;
 return safeId(p.id)&&safeCustomer(p.customerId)&&
  ['before','after','property'].includes(p.category)&&
  typeof p.caption==='string'&&p.caption.length<=2000&&
  typeof p.filename==='string'&&p.filename.length>0&&p.filename.length<=240&&
  typeof p.contentType==='string'&&photoTypes.has(p.contentType.toLowerCase())&&
  Number.isSafeInteger(p.sizeBytes)&&p.sizeBytes>0&&p.sizeBytes<=MAX_PHOTO&&
  typeof p.createdAt==='string'&&Number.isFinite(Date.parse(p.createdAt))&&
  typeof p.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.sha256);
}
export function inspectStoredFirePhotoZip(zip){
 if(!Buffer.isBuffer(zip)||zip.length<=22||zip.length>MAX_ARCHIVE)
  fail('unsupported decrypted ZIP size');
 // FIRE's v1 ZIP writer produces an exact no-comment, one-disk archive.
 const end=zip.length-22;
 if(zip.readUInt32LE(end)!==0x06054b50||
    zip.readUInt16LE(end+4)!==0||zip.readUInt16LE(end+6)!==0||
    zip.readUInt16LE(end+20)!==0)fail('incomplete or unsupported ZIP directory');
 const count=zip.readUInt16LE(end+10),dirBytes=zip.readUInt32LE(end+12),dir=zip.readUInt32LE(end+16);
 if(count!==zip.readUInt16LE(end+8)||count<1||count>MAX_PHOTOS+1||
    dir> end||dirBytes!==end-dir)fail('ZIP directory count or length is inconsistent');
 const entries=new Map();let p=dir,localExpected=0,total=0;
 for(let i=0;i<count;i++){
  if(p+46>end||zip.readUInt32LE(p)!==0x02014b50)
   fail('invalid ZIP directory entry');
  const flags=zip.readUInt16LE(p+8),method=zip.readUInt16LE(p+10),
   crc=zip.readUInt32LE(p+16),compressed=zip.readUInt32LE(p+20),
   size=zip.readUInt32LE(p+24),nameLength=zip.readUInt16LE(p+28),
   extra=zip.readUInt16LE(p+30),comment=zip.readUInt16LE(p+32),
   disk=zip.readUInt16LE(p+34),local=zip.readUInt32LE(p+42);
  if(flags!==0x0808||method!==0||compressed!==size||disk!==0||
     extra!==0||comment!==0||size>MAX_ARCHIVE||p+46+nameLength>end)
   fail('unsupported ZIP entry type or metadata');
  const name=decoder.decode(zip.subarray(p+46,p+46+nameLength));
  if((name!=='manifest.json'&&!/^photos\/[a-zA-Z0-9_-]{1,90}$/.test(name))||entries.has(name))
   fail('unknown, unsafe or duplicate ZIP entry');
  if(local!==localExpected||local+30>dir||zip.readUInt32LE(local)!==0x04034b50||
     zip.readUInt16LE(local+6)!==flags||zip.readUInt16LE(local+8)!==0||
     zip.readUInt16LE(local+26)!==nameLength||zip.readUInt16LE(local+28)!==0||
     zip.readUInt32LE(local+14)!==0||zip.readUInt32LE(local+18)!==0||
     zip.readUInt32LE(local+22)!==0)
   fail('ZIP local file or metadata does not match its central directory');
  const nameAt=local+30,start=nameAt+nameLength,descriptor=start+size;
  if(decoder.decode(zip.subarray(nameAt,nameAt+nameLength))!==name||
     descriptor+16>dir||zip.readUInt32LE(descriptor)!==0x08074b50||
     zip.readUInt32LE(descriptor+4)!==crc||
     zip.readUInt32LE(descriptor+8)!==size||
     zip.readUInt32LE(descriptor+12)!==size)
   fail('ZIP data descriptor or stored filename mismatch');
  const contents=zip.subarray(start,descriptor);
  if(crc32(contents)!==crc)fail('ZIP CRC checksum mismatch');
  total+=size;if(total>MAX_ARCHIVE)fail('expanded archive exceeds safe limits');
  entries.set(name,contents);
  localExpected=descriptor+16;
  p+=46+nameLength+extra+comment;
 }
 if(localExpected!==dir||p!==end||!entries.has('manifest.json'))
  fail('ZIP has undeclared bytes or lacks a manifest');
 let manifest;
 try{manifest=JSON.parse(decoder.decode(entries.get('manifest.json')));}
 catch{fail('photo manifest JSON cannot be decoded');}
 if(!manifest||manifest.format!=='fire-offline-photo-vault'||manifest.version!==1||
    manifest.requiresMatchingCustomerRecords!==true||!Array.isArray(manifest.photos)||
    manifest.photos.length!==count-1||manifest.photos.length>MAX_PHOTOS)
  fail('unsupported photo manifest, incomplete inventory or missing relationship declaration');
 const ids=new Set(),customers=new Set();let photoBytes=0;
 for(const item of manifest.photos){
  if(!validPhoto(item)||ids.has(item.id))fail('unsafe or duplicate photo metadata');
  ids.add(item.id);customers.add(item.customerId);
  const bytes=entries.get('photos/'+item.id);
  if(!bytes||bytes.length!==item.sizeBytes||sha(bytes)!==item.sha256)
   fail('original photo bytes are missing or SHA-256 differs');
  photoBytes+=bytes.length;
  if(photoBytes>160*1024*1024)fail('photograph total exceeds supported limit');
 }
 for(const name of entries.keys()){
  if(name!=='manifest.json'&&!ids.has(name.slice(7)))
   fail('archive contains unlisted photo bytes');
 }
 return Object.freeze({
  archiveFormat:'fire-offline-photo-vault',version:1,
  allFilesCryptographicallyVerified:true,
  photoCount:manifest.photos.length,distinctCustomerIds:customers.size,
  totalOriginalPhotoBytes:photoBytes,verifiedZipSha256:sha(zip)
 });
}
async function readPhrase(){
 if(process.stdin.isTTY)fail('pipe a private passphrase on stdin; never type an echoing CLI argument');
 let input='',bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;if(bytes>4096)fail('input exceeds safe phrase limit');
  input+=chunk.toString('utf8');
 }
 input=input.replace(/\r?\n$/,'');
 if(input.length<16||input.length>1024)fail('missing or unsupported recovery passphrase');
 return input;
}
export async function verifyOwnerSavedProtectedPhotoFile(path,phrase){
 if(typeof path!=='string'||!path||typeof phrase!=='string')
  fail('a saved protected file and owner-supplied secret are required');
 let file;
 try{file=await readFile(resolve(path));}
 catch{fail('saved file could not be opened for read-only verification');}
 if(file.length<=64||file.length>MAX_ARCHIVE+4096)
  fail('protected backup file size is unsupported');
 const blob=new Blob([file]);
 if(!await isProtectedOfflinePhotoArchive(blob))
  fail('only encrypted .firephotos files are accepted; old plain ZIPs remain unprotected');
 const decrypted=await recoverProtectedOfflinePhotoZip(blob,phrase);
 const verified=inspectStoredFirePhotoZip(Buffer.from(await decrypted.arrayBuffer()));
 return Object.freeze({
  ...verified,savedFileReadBack:true,encryptedFileSha256:sha(file),
  photoBytesNeverWrittenToDisk:true,
  offDeviceIndependentCustodyVerified:false,
  matchingCompleteD1RecordsVerified:false,
  isolatedFullRestoreVerified:false,hostedPhotoSyncVerified:false,
  ownerApprovedDeployment:false,gate7Accepted:false,providerWriteAttempted:false
 });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==3)fail('usage: node verify_saved_protected_photo_backup.mjs SAVED.firephotos');
  const phrase=await readPhrase();
  const result=await verifyOwnerSavedProtectedPhotoFile(process.argv[2],phrase);
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){
  // Never echo a plaintext ZIP, credentials or arbitrary provider/API output.
  process.stderr.write('FIRE saved photo backup review FAILED: '+(error instanceof Error?error.message:'invalid file')+'\n');
  process.exitCode=1;
 }
}
