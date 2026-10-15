import {createStoredZip} from './photo-storage-zip';

export type OfflinePhoto = {
  id:string;customerId:string;category:'before'|'after'|'property';
  caption:string;filename:string;contentType:string;sizeBytes:number;createdAt:string;blob:Blob;
};
type ArchivePhoto = Omit<OfflinePhoto,'blob'> & {sha256:string};
const MAX_ARCHIVE=160*1024*1024,MAX_PHOTOS=500,decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const SAFE_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/bmp']);
export function supportedOfflinePhotoType(value:string):boolean{return SAFE_IMAGE_TYPES.has(value.toLowerCase());}
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(bytes:ArrayBuffer){return hex(await crypto.subtle.digest('SHA-256',bytes));}
function validMeta(p:Omit<OfflinePhoto,'blob'>){
  return typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(p.id)
   &&typeof p.customerId==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(p.customerId)
   &&['before','after','property'].includes(p.category)
   &&typeof p.caption==='string'&&p.caption.length<=2000
   &&typeof p.filename==='string'&&p.filename.length>0&&p.filename.length<=240
   &&typeof p.contentType==='string'&&supportedOfflinePhotoType(p.contentType)
   &&Number.isSafeInteger(p.sizeBytes)&&p.sizeBytes>0&&p.sizeBytes<=15*1024*1024
   &&typeof p.createdAt==='string'&&Number.isFinite(Date.parse(p.createdAt));
}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function guard(b:boolean,msg:string):asserts b{if(!b)throw Error('Photo backup rejected: '+msg);}
function nameFor(id:string){return 'photos/'+id;}
export async function exportOfflinePhotoBackup(records:OfflinePhoto[]):Promise<Blob>{
 guard(records.length<=MAX_PHOTOS,'too many photos for a single iPhone backup');
 const seen=new Set<string>();let total=0;const prepared:{meta:ArchivePhoto;bytes:Uint8Array}[]=[];
 for(const record of records){
  guard(validMeta(record)&&record.blob instanceof Blob&&record.blob.type===record.contentType&&record.blob.size===record.sizeBytes,'invalid photo or incomplete stored bytes');
  guard(!seen.has(record.id),'duplicate photo identifier');seen.add(record.id);
  total+=record.sizeBytes;guard(total<=MAX_ARCHIVE,'backup exceeds the safe single-file size');
  const bytes=new Uint8Array(await record.blob.arrayBuffer());
  const {blob,...meta}=record;
  prepared.push({meta:{...meta,sha256:await digest(bytes.buffer as ArrayBuffer)},bytes});
 }
 const manifest={format:'fire-offline-photo-vault',version:1,exportedAt:new Date().toISOString(),requiresMatchingCustomerRecords:true,photos:prepared.map(x=>x.meta)};
 const stream=createStoredZip(async add=>{
  for(const item of prepared)await add(nameFor(item.meta.id),item.bytes);
  await add('manifest.json',encoder.encode(JSON.stringify(manifest)));
 });
 const blob=await new Response(stream,{headers:{'content-type':'application/zip'}}).blob();
 guard(blob.size<=MAX_ARCHIVE+1024*1024,'resulting archive too large');
 return new Blob([blob],{type:'application/zip'});
}
export async function readOfflinePhotoBackup(file:Blob):Promise<OfflinePhoto[]>{
 guard(file.size>22&&file.size<=MAX_ARCHIVE+1024*1024,'archive size is unsupported');
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}}
 guard(end>=0,'ZIP directory is missing or incomplete');
 const count=view.getUint16(end+10,true),dirSize=view.getUint32(end+12,true),dirOffset=view.getUint32(end+16,true);
 guard(count<=MAX_PHOTOS+1&&count===view.getUint16(end+8,true)&&dirOffset+dirSize===end,'ZIP directory is inconsistent');
 let offset=dirOffset,total=0;const parts=new Map<string,Uint8Array>();
 for(let index=0;index<count;index++){
  guard(offset+46<=end&&view.getUint32(offset,true)===0x02014b50,'invalid ZIP directory entry');
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),crc=view.getUint32(offset+16,true);
  const packed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true),nameLen=view.getUint16(offset+28,true);
  const extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  guard((flags&1)===0&&method===0&&packed===size&&size<=MAX_ARCHIVE,'ZIP entries must be unencrypted and uncompressed');
  guard(offset+46+nameLen+extra+comment<=end,'ZIP filename is truncated');
  const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLen));
  guard(name==='manifest.json'||/^photos\/[a-zA-Z0-9_-]{1,90}$/.test(name),'unrecognized or unsafe archive path');
  guard(!parts.has(name),'duplicate ZIP entry');
  guard(local+30<=dirOffset&&view.getUint32(local,true)===0x04034b50,'missing local file');
  const localNameLen=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localNameLen+localExtra;
  guard(localNameLen===nameLen&&start+size<=dirOffset&&decoder.decode(bytes.subarray(local+30,local+30+nameLen))===name,'ZIP offsets or local names do not match');
  const content=bytes.slice(start,start+size);
  guard(crc32(content)===crc,'ZIP checksum mismatch');
  total+=size;guard(total<=MAX_ARCHIVE,'expanded ZIP exceeds safety limit');
  parts.set(name,content);offset+=46+nameLen+extra+comment;
 }
 guard(offset===end&&parts.has('manifest.json'),'ZIP contents or manifest incomplete');
 let manifest:unknown;try{manifest=JSON.parse(decoder.decode(parts.get('manifest.json')!));}catch{throw Error('Photo backup rejected: invalid manifest');}
 const data=manifest as {format?:unknown;version?:unknown;requiresMatchingCustomerRecords?:unknown;photos?:unknown};
 guard(data&&data.format==='fire-offline-photo-vault'&&data.version===1&&data.requiresMatchingCustomerRecords===true&&Array.isArray(data.photos),'wrong backup format or version');
 guard(data.photos.length===count-1&&data.photos.length<=MAX_PHOTOS,'photo list does not match ZIP entries');
 const photos:OfflinePhoto[]=[];const ids=new Set<string>();
 for(const item of data.photos){
  const p=item as ArchivePhoto;
  guard(p&&validMeta(p)&&typeof p.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.sha256),'invalid photo manifest metadata');
  guard(!ids.has(p.id),'duplicate photo ID in manifest');ids.add(p.id);
  const contents=parts.get(nameFor(p.id));
  guard(contents!==undefined&&contents.length===p.sizeBytes,'missing photo or incorrect byte length');
  guard(await digest(contents.buffer as ArrayBuffer)===p.sha256,'photo cryptographic checksum mismatch');
  const {sha256,...meta}=p;
  photos.push({...meta,blob:new Blob([contents as BlobPart],{type:p.contentType})});
 }
 return photos;
}
