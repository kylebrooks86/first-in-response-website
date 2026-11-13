import {inspectPhotoStorage} from './photo-storage-integrity';
import {createStoredZip} from './photo-storage-zip';
type Photo={id:string;customerId:string;category:string;caption:string|null;filename:string;contentType:string;sizeBytes:number;objectKey:string;createdAt:string};
type Reader={all<T>(sql:string):Promise<T[]>};
const PHOTO_SQL='SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,object_key AS objectKey,created_at AS createdAt FROM customer_photos ORDER BY id LIMIT 5001';
const CUSTOMER_SQL='SELECT id FROM customers ORDER BY id LIMIT 5001';
const SAFE_KEY=/^customers\/[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9_-]{1,128}\.[a-zA-Z0-9]{1,8}$/;
type BucketObjectIdentity={key:string;size:number;etag:string;version:string};
// Gate 7: the photo archive's supported scope is the customers/ namespace.
// Inventory the ENTIRE R2 bucket first. Unknown object keys must prevent
// a supposedly complete archive from silently omitting durable files.
// Never log, delete or reclassify unknown objects.
async function completePhotoBucketInventory(bucket:R2Bucket):Promise<BucketObjectIdentity[]>{
 const objects:BucketObjectIdentity[]=[],keys=new Set<string>(),cursors=new Set<string>();
 let cursor:string|undefined;
 for(let page=0;page<=5000;page++){
  const result=await bucket.list({limit:1000,...(cursor?{cursor}:{})});
  if(!result||!Array.isArray(result.objects)||typeof result.truncated!=='boolean')
   throw Error('R2 photo bucket inventory was incomplete.');
  for(const object of result.objects){
   if(typeof object.key!=='string'||!SAFE_KEY.test(object.key))
    throw Error('R2 bucket contains a file outside the reviewed complete-photo archive contract.');
   if(keys.has(object.key)||!Number.isSafeInteger(object.size)||object.size<0||
     typeof object.etag!=='string'||!object.etag||typeof object.version!=='string'||!object.version)
    throw Error('R2 bucket inventory contains duplicate or invalid object identities.');
   keys.add(object.key);
   objects.push({key:object.key,size:object.size,etag:object.etag,version:object.version});
   if(objects.length>5000)throw Error('R2 bucket exceeds the reviewed complete-photo archive limit.');
  }
  if(!result.truncated)return objects.sort((a,b)=>a.key.localeCompare(b.key));
  if(!result.cursor||cursors.has(result.cursor))throw Error('R2 full-bucket pagination did not prove complete coverage.');
  cursors.add(result.cursor);cursor=result.cursor;
 }
 throw Error('R2 full-bucket inventory exceeded safe pagination.');
}
const sha256=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function exportCompletePhotoStorage(reader:Reader,bucket:R2Bucket){
 const photos=await reader.all<Photo>(PHOTO_SQL),customers=await reader.all<{id:string}>(CUSTOMER_SQL);
 if(customers.some(c=>typeof c.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(c.id)))throw Error('Invalid customer identity coverage.');
 if(photos.some(p=>!['before','after','property'].includes(p.category)||typeof p.filename!=='string'||(p.caption!==null&&typeof p.caption!=='string')||typeof p.createdAt!=='string'||!Number.isFinite(Date.parse(p.createdAt))))throw Error('Invalid photo metadata prevents a complete archive.');
 const bucketBefore=await completePhotoBucketInventory(bucket);
 const inspection=await inspectPhotoStorage(reader,bucket);
 if(!inspection.referencedMetadataMatches)throw Error('Missing, conflicting or changing photo records prevent a complete archive.');
 const inventory=inspection.objectInventory;
 if(JSON.stringify(bucketBefore)!==JSON.stringify(inventory))
  throw Error('R2 full bucket and customer photo namespace do not reconcile; archive blocked.');
 if(inventory.some(o=>!SAFE_KEY.test(o.key)||o.size>20*1024*1024)||inventory.reduce((sum,o)=>sum+o.size,0)>250*1024*1024)throw Error('Photo storage exceeds safe complete-archive bounds or contains unsafe object keys.');
 const byKey=new Map(photos.map(p=>[p.objectKey,p]));
 const objects:{objectKey:string;archivePath:string;sizeBytes:number;contentType:string|null;version:string;etag:string;sha256:string;association:'referenced'|'unreferenced';photoId:string|null}[]=[];
 const stream=createStoredZip(async add=>{
  for(const [index,item] of inventory.entries()){
   const object=await bucket.get(item.key);
   if(!object||object.version!==item.version||object.etag!==item.etag||object.size!==item.size)throw Error('Photo storage changed during export. Preserve the source and review before retrying.');
   const buffer=await object.arrayBuffer();
   if(buffer.byteLength!==item.size)throw Error('Photo bytes are incomplete.');
   const photo=byKey.get(item.key),contentType=object.httpMetadata?.contentType??null;
   if(photo&&(photo.sizeBytes!==buffer.byteLength||photo.contentType!==contentType))throw Error('Referenced photo metadata changed during export.');
   const archivePath=`objects/${String(index).padStart(6,'0')}.bin`;
   objects.push({objectKey:item.key,archivePath,sizeBytes:buffer.byteLength,contentType,version:item.version,etag:item.etag,sha256:await sha256(buffer),association:photo?'referenced':'unreferenced',photoId:photo?.id??null});
   await add(archivePath,new Uint8Array(buffer));
  }
  const finalPhotos=await reader.all<Photo>(PHOTO_SQL),finalCustomers=await reader.all<{id:string}>(CUSTOMER_SQL),final=await inspectPhotoStorage(reader,bucket),bucketAfter=await completePhotoBucketInventory(bucket);
  if(JSON.stringify(photos)!==JSON.stringify(finalPhotos)||JSON.stringify(customers)!==JSON.stringify(finalCustomers)||!final.referencedMetadataMatches||JSON.stringify(inventory)!==JSON.stringify(final.objectInventory)||JSON.stringify(bucketBefore)!==JSON.stringify(bucketAfter))throw Error('Photo coverage changed during export; the archive is incomplete.');
  const manifest={format:'fire-app-photo-storage-archive',version:2,scope:'customer-photo-namespace',exportedAt:new Date().toISOString(),objectCount:objects.length,photoCount:photos.length,unreferencedObjectCount:objects.filter(o=>o.association==='unreferenced').length,customerIds:customers.map(c=>c.id),photos,objects,coverageVerified:true,checksumAlgorithm:'SHA-256',atomicSnapshot:false,requiresSeparateRecordsBackup:true,restoreExecutionAuthorized:false,warning:'Preserves referenced and retained unreferenced bytes in the customer-photo namespace. Unreferenced files must not create invented customer/photo records. Stable observations do not prove a cross-service atomic snapshot or hosted disaster recovery.'};
  const manifestBytes=new TextEncoder().encode(JSON.stringify(manifest,null,2));
  if(manifestBytes.byteLength>5*1024*1024)throw Error('Archive manifest exceeds the safe validation limit.');
  await add('manifest.json',manifestBytes);
 });
 return new Response(stream,{headers:{'content-type':'application/zip','cache-control':'no-store','content-disposition':`attachment; filename=fire-photo-storage-${new Date().toISOString().slice(0,10)}.zip`}});
}
