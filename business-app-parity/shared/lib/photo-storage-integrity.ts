/** Read-only photo reconciliation. Unreferenced bytes are evidence, never cleanup candidates. */
export type PhotoIntegrityRow={id:string;customerId:string;objectKey:string;contentType:string;sizeBytes:number};
type Reader={all<T>(sql:string):Promise<T[]>};
type PhotoBucket=Pick<R2Bucket,'list'|'head'>;
const PHOTO_SQL='SELECT id,customer_id AS customerId,object_key AS objectKey,content_type AS contentType,size_bytes AS sizeBytes FROM customer_photos ORDER BY id LIMIT 5001';
const CUSTOMER_SQL='SELECT id FROM customers ORDER BY id LIMIT 5001';
const LIMIT=5000;
const validKey=(row:PhotoIntegrityRow)=>/^[a-zA-Z0-9_-]{1,128}$/.test(row.id)&&/^[a-zA-Z0-9_-]{1,128}$/.test(row.customerId)&&typeof row.objectKey==='string'&&row.objectKey.startsWith(`customers/${row.customerId}/${row.id}.`)&&/^[a-zA-Z0-9]{1,8}$/.test(row.objectKey.slice(`customers/${row.customerId}/${row.id}.`.length));
export async function inspectPhotoStorage(reader:Reader,bucket:PhotoBucket){
 const read=async()=>({customers:await reader.all<{id:string}>(CUSTOMER_SQL),photos:await reader.all<PhotoIntegrityRow>(PHOTO_SQL)});
 const initial=await read();
 if(initial.photos.length>LIMIT||initial.customers.length>LIMIT)throw Error('Photo inspection exceeds the bounded scan limit. No storage changes were attempted.');
 const customers=new Set(initial.customers.map(c=>c.id));
 if(customers.size!==initial.customers.length)throw Error('Customer identity coverage is invalid.');
 const issues:{photoId:string;reason:string}[]=[],ids=new Set<string>(),keys=new Set<string>();
 for(const row of initial.photos){
  if(typeof row.id!=='string'||!row.id||typeof row.customerId!=='string'||!customers.has(row.customerId)||!validKey(row)||typeof row.contentType!=='string'||!row.contentType.startsWith('image/')||!Number.isSafeInteger(row.sizeBytes)||row.sizeBytes<0||row.sizeBytes>20*1024*1024||ids.has(row.id)||keys.has(row.objectKey))issues.push({photoId:String(row.id),reason:'invalid_metadata_or_relationship'});
  ids.add(row.id);keys.add(row.objectKey);
 }
 const inventory=async()=>{
  const objects=new Map<string,{key:string;size:number;etag:string;version:string}>(),cursors=new Set<string>();let cursor:string|undefined;
  for(let page=0;page<=LIMIT;page++){
   const result=await bucket.list({prefix:'customers/',limit:1000,...(cursor?{cursor}:{})});
   if(!result||!Array.isArray(result.objects)||typeof result.truncated!=='boolean')throw Error('Photo storage returned an incomplete inventory.');
   for(const object of result.objects){
    if(!object.key.startsWith('customers/')||objects.has(object.key)||!Number.isSafeInteger(object.size)||object.size<0||typeof object.etag!=='string'||typeof object.version!=='string')throw Error('Photo storage inventory contains invalid or duplicate objects.');
    objects.set(object.key,{key:object.key,size:object.size,etag:object.etag,version:object.version});
    if(objects.size>LIMIT)throw Error('Photo storage exceeds the bounded scan limit.');
   }
   if(!result.truncated)return [...objects.values()].sort((a,b)=>a.key.localeCompare(b.key));
   if(!result.cursor||cursors.has(result.cursor))throw Error('Photo storage pagination did not confirm complete coverage.');
   cursors.add(result.cursor);cursor=result.cursor;
  }
  throw Error('Photo storage pagination exceeded the scan limit.');
 };
 const objects=await inventory(),byKey=new Map(objects.map(o=>[o.key,o]));
 for(const row of initial.photos){
  if(issues.some(issue=>issue.photoId===row.id))continue;
  const object=await bucket.head(row.objectKey),listed=byKey.get(row.objectKey);
  if(!object||!listed){issues.push({photoId:row.id,reason:'missing_object'});continue;}
  if(object.size!==row.sizeBytes)issues.push({photoId:row.id,reason:'size_mismatch'});
  if(object.httpMetadata?.contentType!==row.contentType)issues.push({photoId:row.id,reason:'content_type_mismatch'});
  if(object.etag!==listed.etag||object.version!==listed.version||object.size!==listed.size)issues.push({photoId:row.id,reason:'object_changed_during_scan'});
 }
 const final=await read(),finalObjects=await inventory();
 const stable=JSON.stringify(initial)===JSON.stringify(final)&&JSON.stringify(objects)===JSON.stringify(finalObjects);
 const retainedUnreferencedObjects=objects.filter(object=>!keys.has(object.key));
 return {format:'fire-photo-storage-inspection',version:1,metadataPhotoCount:initial.photos.length,storageObjectCount:objects.length,issues,retainedUnreferencedObjects,
  completeInventory:true,observationsStable:stable,referencedMetadataMatches:stable&&issues.length===0,
  recoveryReady:false,snapshotAtomic:false,photoBytesVerified:false,cleanupAuthorized:false,writesAttempted:0,
  warning:'Read-only observations cannot prove an atomic backup or byte-level recovery. Keep all unreferenced objects; never automatically retry or delete them.'};
}
