/** FIRE no-R2 paired encrypted-backup custody receipt (SOURCE-ONLY).
 * Binds the exact SAVED .firerecords and .firephotos bytes together without
 * copying either sensitive file or opening a provider connection. This does
 * NOT prove that the device exported all photos or records at the same time.
 * Those relationship/inventory checks still run at private recovery.
 */
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {open,readFile,lstat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const stop=x=>{throw Error('FIRE protected recovery pair BLOCKED: '+x);};
const MAX_RECORDS=112*1024*1024+8192;
const MAX_PHOTOS=161*1024*1024+8192;
const fmt='fire-saved-protected-record-photo-pair';
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
async function fingerprint(file,sizeMax,magic){
 if(typeof file!=='string'||!file)stop('owner-saved encrypted file path required');
 const path=resolve(file);
 let info;
 try{info=await lstat(path);}
 catch{stop('owner-saved encrypted file is inaccessible');}
 if(!info.isFile()||info.isSymbolicLink()||info.size<64||info.size>sizeMax)
  stop('saved file is missing, not regular or exceeds safe limits');
 const digest=createHash('sha256');let size=0,first=Buffer.alloc(0);
 try{
  for await(const data of createReadStream(path)){
   if(first.length<magic.length)first=Buffer.concat([first,data]).subarray(0,magic.length);
   size+=data.length;
   if(size>sizeMax)stop('saved file expanded during read');
   digest.update(data);
  }
 }catch(e){
  if(e instanceof Error&&e.message.includes('FIRE protected recovery pair BLOCKED:'))throw e;
  stop('saved protected backup could not be read safely');
 }
 if(size!==info.size||first.toString('ascii')!==magic)
  stop('saved protected backup changed or has incorrect encrypted format');
 return Object.freeze({sha256:digest.digest('hex'),bytes:size});
}
function checkReceipt(x){
 const fields=['format','version','recordsSha256','recordsBytes','photosSha256',
  'photosBytes','encryptedInputsOnly','offDeviceCustodyVerified','gate7Accepted'];
 if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).sort().join('|')!==fields.sort().join('|')||
    x.format!==fmt||x.version!==1||
    !hex(x.recordsSha256)||!hex(x.photosSha256)||
    !Number.isSafeInteger(x.recordsBytes)||x.recordsBytes<64||x.recordsBytes>MAX_RECORDS||
    !Number.isSafeInteger(x.photosBytes)||x.photosBytes<64||x.photosBytes>MAX_PHOTOS||
    x.encryptedInputsOnly!==true||
    x.offDeviceCustodyVerified!==false||x.gate7Accepted!==false)
  stop('invalid or incomplete protected pair receipt');
 return x;
}
export async function inspectSavedProtectedPairReceipt(receiptPath,records,photos){
 if(typeof receiptPath!=='string'||!receiptPath||
    new Set([receiptPath,records,photos].map(x=>resolve(x))).size!==3)
  stop('three distinct receipt and encrypted backup paths required');
 let raw;
 try{
  const st=await lstat(resolve(receiptPath));
  if(!st.isFile()||st.isSymbolicLink()||st.size<20||st.size>2048)
   stop('saved receipt missing or overlong');
  raw=await readFile(resolve(receiptPath));
  if(raw.length!==st.size)stop('saved receipt size changed during read');
 }catch(e){
  if(e instanceof Error&&e.message.includes('FIRE protected recovery pair BLOCKED:'))throw e;
  stop('saved receipt could not be opened');
 }
 let receipt;
 try{receipt=checkReceipt(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));}
 catch{stop('saved receipt is malformed or unsupported');}
 const [record,photo]=await Promise.all([
  fingerprint(records,MAX_RECORDS,'FIRERB01'),
  fingerprint(photos,MAX_PHOTOS,'FIREPX01')
 ]);
 if(receipt.recordsSha256!==record.sha256||
    receipt.recordsBytes!==record.bytes||
    receipt.photosSha256!==photo.sha256||
    receipt.photosBytes!==photo.bytes)
  stop('records and photos are not the exact originally paired encrypted files');
 return Object.freeze({
  exactSavedEncryptedPairVerified:true,
  protectedRecordsSha256:record.sha256,protectedPhotosSha256:photo.sha256,
  encryptedRecordsBytes:record.bytes,encryptedPhotosBytes:photo.bytes,
  snapshotSameTimeVerified:false,photoInventoryCompleteVerified:false,
  offDeviceCustodyVerified:false,gate7Accepted:false,remoteWritesPerformed:false
 });
}
export async function sealProtectedPairReceipt(records,photos,output){
 if([records,photos,output].some(x=>typeof x!=='string'||!x)||
    new Set([records,photos,output].map(x=>resolve(x))).size!==3)
  stop('two protected source files and a distinct exclusive receipt are required');
 const [record,photo]=await Promise.all([
  fingerprint(records,MAX_RECORDS,'FIRERB01'),
  fingerprint(photos,MAX_PHOTOS,'FIREPX01')
 ]);
 const receipt=checkReceipt({
  format:fmt,version:1,
  recordsSha256:record.sha256,recordsBytes:record.bytes,
  photosSha256:photo.sha256,photosBytes:photo.bytes,
  encryptedInputsOnly:true,offDeviceCustodyVerified:false,gate7Accepted:false
 });
 let handle,created=false;
 try{
  handle=await open(resolve(output),'wx',0o600);created=true;
  await handle.writeFile(JSON.stringify(receipt)+'\n','utf8');
  await handle.sync();await handle.close();handle=undefined;
  const checked=await inspectSavedProtectedPairReceipt(output,records,photos);
  return Object.freeze({savedPairReceiptCreated:true,...checked});
 }catch(e){
  if(handle)await handle.close().catch(()=>{});
  if(created)await unlink(resolve(output)).catch(()=>{});
  throw e;
 }
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==5)stop('usage: RECORDS.firerecords PHOTOS.firephotos OUTPUT.firepair');
  const output=await sealProtectedPairReceipt(process.argv[2],process.argv[3],process.argv[4]);
  console.log(JSON.stringify(output));
 }catch{
  console.error('FIRE protected backup pairing BLOCKED; no hosted resources changed.');
  process.exitCode=1;
 }
}
