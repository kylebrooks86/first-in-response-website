/** Real Chrome/IndexedDB photo integration test. No cloud calls or real user records. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const modulePath=process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE;
if(!modulePath||!process.env.FIRE_BROWSER_TEST_EXECUTABLE)throw Error('Use pinned isolated Chrome test runner; no browser download.');
const {chromium}=require(modulePath);
const sources={};
for(const [name,path] of Object.entries({
 zip:'../lib/photo-storage-zip.ts',
 archive:'../lib/offline-photo-backup.ts',
 vault:'../lib/local-photo-vault.ts',
 directory:'../lib/offline-photo-customer-directory.ts',
 inspection:'../lib/offline-photo-inspection.ts'
})){
 const content=readFileSync(new URL(path,import.meta.url),'utf8');
 sources[name]=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
const server=createServer((_req,res)=>{
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
 res.end('<!doctype html><title>Synthetic FIRE offline photo origin</title><main>Isolated browser verification</main>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address(),origin='http://127.0.0.1:'+address.port;
let browser,passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;console.log('PASS: '+message);};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();
 const page=await context.newPage();
 const inject=async()=>page.evaluate(source=>{
  const modules={};
  const run=name=>{
   if(modules[name])return modules[name];
   const exports={};
   const req=path=>{
    if(path==='./photo-storage-zip')return run('zip');
    if(path==='./offline-photo-backup')return run('archive');
    if(path==='./local-photo-vault')return run('vault');
    if(path==='../app/local-customer-deployment')return {LOCAL_CUSTOMER_DEPLOYMENT:'live'};
    throw Error('Undeclared test-only import '+path);
   };
   new Function('exports','require',source[name])(exports,req);
   modules[name]=exports;if(name==='archive')window.FIRE_ARCHIVE_MODULE=exports;return exports;
  };
  window.FIRE_LOCAL_PHOTOS=run('vault');
  window.FIRE_OFFLINE_PHOTO_CUSTOMERS=run('directory');
  window.FIRE_PHOTO_BACKUP_INSPECTION=run('inspection');
 },sources);
 await page.goto(origin);await inject();
 const created=await page.evaluate(async()=>{
  const v=window.FIRE_LOCAL_PHOTOS;
  const file=new File([new TextEncoder().encode('photo-one-binary')],'fixture-before.png',{type:'image/png'});
  const photo=await v.addOfflinePhoto('synthetic-customer','before','north siding',file);
  const list=await v.listOfflinePhotos('synthetic-customer');
  return {photoId:photo.id,length:list.length,size:list[0]?.blob.size,category:list[0]?.category,caption:list[0]?.caption};
 });
 check(created.length===1&&created.size===16,'Actual browser IndexedDB saves complete binary photo and lists it by customer');
 check(created.category==='before'&&created.caption==='north siding','Actual browser persists photo label and caption');
 await page.reload();await inject();
 const remembered=await page.evaluate(async()=>{
  const rows=await window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer');
  return {count:rows.length,photoId:rows[0]?.id,bytes:rows[0]?await rows[0].blob.text():null};
 });
 check(remembered.count===1&&remembered.photoId===created.photoId,'Photo persists across complete browser page restart');
 check(remembered.bytes==='photo-one-binary','Real IndexedDB blob bytes persist unchanged across restart');
 const customerDir=await page.evaluate(async()=>{
  const d=window.FIRE_OFFLINE_PHOTO_CUSTOMERS;
  await d.saveOfflinePhotoCustomerDirectory([{id:'synthetic-customer',name:'Synthetic Customer'},{id:'other-customer',name:'Other Customer'}]);
  return await d.loadOfflinePhotoCustomerDirectory();
 });
 check(customerDir.length===2&&customerDir[0].name==='Other Customer','Online synced identity directory retains minimal customer IDs and names only');
 check(customerDir.every(c=>Object.keys(c).sort().join(',')==='id,name'),'Offline photo customer cache excludes addresses, finances, phone numbers and notes');
 await page.reload();await inject();
 check((await page.evaluate(async()=>window.FIRE_OFFLINE_PHOTO_CUSTOMERS.loadOfflinePhotoCustomerDirectory().then(rows=>rows.length)))===2,'Minimal on-device customer directory survives cold reload');
 const declinedUpdate=await page.evaluate(async()=>{
  const d=window.FIRE_OFFLINE_PHOTO_CUSTOMERS;
  try{await d.saveOfflinePhotoCustomerDirectory([{id:'synthetic-customer',name:'A'},{id:'synthetic-customer',name:'B'}]);return false;}
  catch{return true;}
 });
 check(declinedUpdate,'Invalid duplicate customer directory refuses replacement');
 check((await page.evaluate(async()=>window.FIRE_OFFLINE_PHOTO_CUSTOMERS.loadOfflinePhotoCustomerDirectory().then(x=>x.length)))===2,'Rejected directory update preserves the previously valid directory');
 const stagingDirectory=await page.evaluate(source=>{
  const exports={};
  new Function('exports','require',source.directory)(exports,(name)=>{
   if(name==='../app/local-customer-deployment')return {LOCAL_CUSTOMER_DEPLOYMENT:'staging'};
   throw Error('Unexpected directory import '+name);
  });
  return exports.loadOfflinePhotoCustomerDirectory().then(rows=>rows.length);
 },sources);
 check(stagingDirectory===0,'Staging candidate cannot read LIVE customer directory on a shared browser origin');
 // Verify a second fixed deployment cannot read a LIVE candidate's photos,
 // even when this test intentionally places both candidates on one origin.
 const isolated=await page.evaluate(source=>{
   const exports={};
   const req=(name)=>{
     if(name==='../app/local-customer-deployment')return {LOCAL_CUSTOMER_DEPLOYMENT:'staging'};
     if(name==='./offline-photo-backup')return window.FIRE_ARCHIVE_MODULE;
     throw Error('Unexpected import '+name);
   };
   // Compile the exact same source with the staging deployment adapter.
   new Function('exports','require',source.vault)(exports,req);
   return exports.listOfflinePhotos('synthetic-customer').then(rows=>rows.length);
 },sources);
 check(isolated===0,'LIVE and staging candidate IndexedDB photo stores cannot cross-read on a shared origin');
 const archiveBytes=await page.evaluate(async()=>{
  const zip=await window.FIRE_LOCAL_PHOTOS.exportLocalPhotos();
  return Array.from(new Uint8Array(await zip.arrayBuffer()));
 });
 check(archiveBytes.length>100,'Actual IndexedDB-to-ZIP export produces nonempty user backup');
 const concurrentExportGuard=await page.evaluate(async()=>{
  const vault=window.FIRE_LOCAL_PHOTOS;
  const rows=await vault.listOfflinePhotos('synthetic-customer');
  return {
   stable:vault.sameOfflinePhotoInventory(rows,rows),
   extra:vault.sameOfflinePhotoInventory(rows,[...rows,{...rows[0],id:'unexpected-concurrent-photo'}]),
   deleted:vault.sameOfflinePhotoInventory(rows,[]),
   swappedId:vault.sameOfflinePhotoInventory(rows,rows.map(row=>({...row,id:'replaced-photo'}))),
   amendedSize:vault.sameOfflinePhotoInventory(rows,rows.map(row=>({...row,sizeBytes:row.sizeBytes+1}))),
  };
 });
 check(concurrentExportGuard.stable&&!concurrentExportGuard.extra&&!concurrentExportGuard.deleted,
   'Mobile ZIP export inventory guard refuses an added or deleted photo from another tab');
 check(!concurrentExportGuard.swappedId&&!concurrentExportGuard.amendedSize,
   'Mobile ZIP export inventory guard refuses a same-count photo replacement or changed metadata');
 const concurrentSameLengthBytes=await page.evaluate(async bytes=>{
  const vault=window.FIRE_LOCAL_PHOTOS;
  const current=await vault.listOfflinePhotos('synthetic-customer');
  const originalBytes=await current[0].blob.arrayBuffer();
  const exact=[{...current[0],blob:new Blob([originalBytes],{type:current[0].contentType})}];
  const changed=[{...current[0],blob:new Blob([new TextEncoder().encode('photo-one-binarY')],{type:'image/png'})}];
  return {
    sameLength:current[0].blob.size===changed[0].blob.size,
    metadataOnlyWouldPass:vault.sameOfflinePhotoInventory(current,changed),
    byteIdenticalAcceptsOriginal:await vault.byteIdenticalOfflinePhotoInventory(current,exact),
    byteIdenticalRejectsReplacement:!await vault.byteIdenticalOfflinePhotoInventory(current,changed),
    savedZipStillMatchesCurrent:await vault.byteIdenticalOfflinePhotoInventory(
      await window.FIRE_ARCHIVE_MODULE.readOfflinePhotoBackup(
        new Blob([new Uint8Array(bytes)])),current),
  };
 },archiveBytes);
 check(concurrentSameLengthBytes.sameLength&&concurrentSameLengthBytes.metadataOnlyWouldPass,
   'Regression fixture reproduces hidden same-size byte drift that metadata-only comparison misses');
 check(concurrentSameLengthBytes.byteIdenticalAcceptsOriginal&&
   concurrentSameLengthBytes.byteIdenticalRejectsReplacement,
   'Actual mobile backup comparison detects identical-metadata changed image bytes');
 check(concurrentSameLengthBytes.savedZipStillMatchesCurrent,
   'Byte-level export validation matches current IndexedDB photos to the ZIP image bytes');
 const savedInspection=await page.evaluate(async bytes=>
   window.FIRE_PHOTO_BACKUP_INSPECTION.inspectSavedOfflinePhotoZip(
    new Blob([new Uint8Array(bytes)]),['synthetic-customer']),archiveBytes);
 check(savedInspection.archivePhotoCount===1&&savedInspection.byteIdenticalOnDevice===1&&
   savedInspection.notYetOnDevice===0&&savedInspection.localPhotosNotInArchive===0,
   'ZIP reselected from simulated Files is independently re-read and verified against on-device image bytes');
 const failedUnknownInspection=await page.evaluate(async bytes=>{
  try{await window.FIRE_PHOTO_BACKUP_INSPECTION.inspectSavedOfflinePhotoZip(
   new Blob([new Uint8Array(bytes)]),['unknown-customer']);return false;}
  catch{return true;}
 },archiveBytes);
 check(failedUnknownInspection,'Saved ZIP inspector refuses unknown customer ownership without modifying photos');
 const duplicate=await page.evaluate(async bytes=>
  window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']),archiveBytes);
 check(duplicate.restored===0&&duplicate.alreadyPresent===1,'Replaying the same ZIP safely skips identical photos instead of failing');
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===1,'Idempotent ZIP replay never creates duplicate photos');
 const wrongCustomer=await page.evaluate(async bytes=>{
  try{await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['wrong-customer']);return 'unexpected success';}
  catch{return 'refused';}
 },archiveBytes);
 check(wrongCustomer==='refused','Restore refuses photographs for a missing customer record');
 // Corrupt the actual stored image bytes, not an unused ZIP attribute.
 // A strong integrity test must fail for CRC-32/SHA-256 reasons.
 const damaged=archiveBytes.slice(),needle=Array.from(new TextEncoder().encode('photo-one-binary'));
 let damagedAt=-1;
 findPhoto:for(let i=0;i<=damaged.length-needle.length;i++){
  for(let j=0;j<needle.length;j++)if(damaged[i+j]!==needle[j])continue findPhoto;
  damagedAt=i;break;
 }
 check(damagedAt>=0,'Corruption fixture located the actual embedded photo bytes');
 damaged[damagedAt]^=1;
 const rejected=await page.evaluate(async bytes=>{
  try{await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']);return 'unexpected success';}
  catch{return 'refused';}
 },damaged);
 check(rejected==='refused','Damaged archive fails closed without writing customer photos');
 const verificationRejectsCorruption=await page.evaluate(async bytes=>{
  try{await window.FIRE_PHOTO_BACKUP_INSPECTION.inspectSavedOfflinePhotoZip(
   new Blob([new Uint8Array(bytes)]),['synthetic-customer']);return false;}
  catch{return true;}
 },damaged);
 check(verificationRejectsCorruption,'Saved ZIP verification rejects corrupted image content and does not write to storage');
 await page.evaluate(async id=>{await window.FIRE_LOCAL_PHOTOS.removeOfflinePhoto(id,'synthetic-customer');},created.photoId);
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===0,'Deliberate photo deletion is verified on device');
 const restored=await page.evaluate(async bytes=>{
  return await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']);
 },archiveBytes);
 check(restored.restored===1&&restored.alreadyPresent===0,'Fully validated ZIP restores into empty on-device vault');
 const after=await page.evaluate(async()=>{
  const x=await window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer');return {count:x.length,bytes:await x[0].blob.text()};
 });
 check(after.count===1&&after.bytes==='photo-one-binary','Actual browser round-trip preserved byte-identical photo');
 const postRestoreByteVerification=await page.evaluate(async bytes=>{
  const vault=window.FIRE_LOCAL_PHOTOS;
  const archived=await window.FIRE_ARCHIVE_MODULE.readOfflinePhotoBackup(
   new Blob([new Uint8Array(bytes)]));
  const [original]=await vault.listOfflinePhotos('synthetic-customer');
  const changed={...original,blob:new Blob(
   [new TextEncoder().encode('photo-one-binarY')],{type:original.contentType})};
  if(changed.blob.size!==original.blob.size)throw Error('Fixture is not same-length byte drift');
  // Introduce a synthetic competing tab's update through the real browser
  // IndexedDB API; this is a disposable Chrome profile, never an owner vault.
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('fire-private-offline-photos-live-v1');
   request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Unexpected photo DB namespace'));};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const put=row=>new Promise((resolve,reject)=>{
   const tx=db.transaction('photos','readwrite');
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
   tx.objectStore('photos').put(row);
  });
  try{
   await put(changed);
   let conflictRejected=false;
   try{await vault.verifyRestoredOfflinePhotos(archived);}
   catch(error){conflictRejected=String(error).includes('bytes or metadata changed');}
   // Restore the original only inside the synthetic test fixture.
   await put(original);
   await vault.verifyRestoredOfflinePhotos(archived);
   const replay=await vault.restoreLocalPhotos(
    new Blob([new Uint8Array(bytes)]),['synthetic-customer']);
   return {conflictRejected,replay,verifiedOriginal:
    (await vault.listOfflinePhotos('synthetic-customer'))[0].blob.size===original.blob.size};
  }finally{db.close();}
 },archiveBytes);
 check(postRestoreByteVerification.conflictRejected,
  'Post-restore validation rejects concurrent same-size photo byte replacement in real IndexedDB');
 check(postRestoreByteVerification.replay.restored===0&&
  postRestoreByteVerification.replay.alreadyPresent===1&&
  postRestoreByteVerification.verifiedOriginal,
  'Idempotent restore verifies all previously stored photo bytes before reporting success');
 // A customer can import a newer ZIP when some photos already exist:
 // retain originals, add missing ones, and report both categories.
 const merge=await page.evaluate(async()=>{
  const vault=window.FIRE_LOCAL_PHOTOS;
  const second=await vault.addOfflinePhoto('synthetic-customer','after','later job',
    new File([new TextEncoder().encode('second-photo')],'second.png',{type:'image/png'}));
  const archive=await vault.exportLocalPhotos('synthetic-customer');
  await vault.removeOfflinePhoto(second.id,'synthetic-customer');
  const result=await vault.restoreLocalPhotos(archive,['synthetic-customer']);
  const rows=await vault.listOfflinePhotos('synthetic-customer');
  return {result,count:rows.length,secondByteMatch:await rows.find(row=>row.id===second.id).blob.text()==='second-photo',secondId:second.id};
 });
 check(merge.result.restored===1&&merge.result.alreadyPresent===1,'Partial restore adds only missing photos and skips already-identical originals');
 check(merge.count===2&&merge.secondByteMatch,'Partial restore keeps the exact two photo blobs and customer associations');
 const oldZipInspection=await page.evaluate(async bytes=>
  window.FIRE_PHOTO_BACKUP_INSPECTION.inspectSavedOfflinePhotoZip(
   new Blob([new Uint8Array(bytes)]),['synthetic-customer']),archiveBytes);
 check(oldZipInspection.localPhotosNotInArchive===1&&oldZipInspection.byteIdenticalOnDevice===1,
   'Backup inspector clearly reports later photos absent from an older saved ZIP');
 // A malicious or stale ZIP with an existing ID but different bytes must be
 // rejected in full, including any otherwise new photos in the same archive.
 const conflicting=await page.evaluate(async()=>{
  const vault=window.FIRE_LOCAL_PHOTOS,archive=window.FIRE_ARCHIVE_MODULE;
  const originals=await vault.listOfflinePhotos('synthetic-customer');
  const original=originals.find(row=>row.caption==='north siding');
  const editedBlob=new Blob([new TextEncoder().encode('photo-one-binarY')],{type:'image/png'});
  const changed={...original,blob:editedBlob,sizeBytes:editedBlob.size};
  const unexpected={...changed,id:'new-photo-should-not-import',caption:'should not write'};
  const badArchive=await archive.exportOfflinePhotoBackup([unexpected,changed]);
  let denied=false;
  try{await vault.restoreLocalPhotos(badArchive,['synthetic-customer']);}
  catch(error){denied=String(error).includes('different data');}
  const now=await vault.listOfflinePhotos('synthetic-customer');
  return {denied,count:now.length,byteMatch:await now.find(row=>row.id===original.id).blob.text()==='photo-one-binary',newNotAdded:!now.some(row=>row.id==='new-photo-should-not-import')};
 });
 check(conflicting.denied&&conflicting.byteMatch,'Same photo ID with different bytes fails closed and preserves the original');
 check(conflicting.count===2&&conflicting.newNotAdded,'Conflicting mixed archive never partially inserts new photo rows');
 const inspectionConflict=await page.evaluate(async()=>{
  const vault=window.FIRE_LOCAL_PHOTOS,arch=window.FIRE_ARCHIVE_MODULE;
  const originals=await vault.listOfflinePhotos('synthetic-customer');
  const existing=originals.find(row=>row.caption==='north siding');
  const edited=new Blob([new TextEncoder().encode('photo-one-binarY')],{type:'image/png'});
  const badZip=await arch.exportOfflinePhotoBackup([{...existing,blob:edited,sizeBytes:edited.size}]);
  try{await window.FIRE_PHOTO_BACKUP_INSPECTION.inspectSavedOfflinePhotoZip(
   badZip,['synthetic-customer']);return false;}
  catch{return true;}
 });
 check(inspectionConflict,'ZIP inspector rejects a same-ID/different-bytes archive without restoring it');
 await page.evaluate(async id=>window.FIRE_LOCAL_PHOTOS.removeOfflinePhoto(id,'synthetic-customer'),merge.secondId);
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===1,'Synthetic merge cleanup preserves remaining photo for offline tests');
 await context.setOffline(true);
 const offline=await page.evaluate(async()=>{
  const directory=await window.FIRE_OFFLINE_PHOTO_CUSTOMERS.loadOfflinePhotoCustomerDirectory();
  if(directory.length!==2||directory.find(row=>row.id==='synthetic-customer')?.name!=='Synthetic Customer')throw Error('Customer-photo directory not accessible offline');
  const v=window.FIRE_LOCAL_PHOTOS;
  const file=new File([new TextEncoder().encode('after-offline')],'fixture-after.png',{type:'image/png'});
  await v.addOfflinePhoto('synthetic-customer','after','done',file);
  const rows=await v.listOfflinePhotos('synthetic-customer');
  const zipped=await v.exportLocalPhotos();
  return {count:rows.length,after:rows.some(r=>r.category==='after'),zipBytes:zipped.size};
 });
 check(offline.count===2&&offline.after&&offline.zipBytes>100,'Customer directory plus photo capture, preview and ZIP export work offline');
 await context.setOffline(false);await page.reload();await inject();
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===2,'Offline-created photo survives network recovery and full page reload');
 await page.evaluate(async()=>window.FIRE_OFFLINE_PHOTO_CUSTOMERS.clearOfflinePhotoCustomerDirectory());
 check((await page.evaluate(async()=>window.FIRE_OFFLINE_PHOTO_CUSTOMERS.loadOfflinePhotoCustomerDirectory().then(rows=>rows.length)))===0,'Owner logout invalidation can erase cached customer names without deleting photo bytes');
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(rows=>rows.length)))===2,'Clearing cached customer names does not delete local photo files');
 // A large business photo library must be exportable customer by customer
 // when the all-customer ZIP exceeds the device-safe 160 MB export limit.
 const subset=await page.evaluate(async()=>{
  const vault=window.FIRE_LOCAL_PHOTOS;
  const image=new File([new TextEncoder().encode('other synthetic photo')],'fixture-other.png',{type:'image/png'});
  await vault.addOfflinePhoto('other-customer','property','separate property',image);
  const only=await vault.exportLocalPhotos('synthetic-customer');
  const full=await vault.exportLocalPhotos();
  const importer=window.FIRE_ARCHIVE_MODULE;
  const mine=await importer.readOfflinePhotoBackup(only),everyone=await importer.readOfflinePhotoBackup(full);
  let invalidRejected=false;
  try{await vault.exportLocalPhotos('../unsafe-path');}catch{invalidRejected=true;}
  return {mineCount:mine.length,mineOwned:mine.every(photo=>photo.customerId==='synthetic-customer'),allCount:everyone.length,otherCount:everyone.filter(photo=>photo.customerId==='other-customer').length,invalidRejected};
 });
 check(subset.mineCount===2&&subset.mineOwned,'Per-customer ZIP export contains only this customer’s photo bytes and labels');
 check(subset.allCount===3&&subset.otherCount===1,'All-customer ZIP still includes every customer’s photos');
 check(subset.invalidRejected,'Scoped export fails closed for unsafe customer identifiers');
 const dashboard=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
 check(dashboard.includes('saveOfflinePhotoCustomerDirectory(nextCustomers.map(')&&dashboard.includes('if(offlinePhotoOnly){'),'Actual FIRE Customers screen supplies photo-only offline fallback from authenticated identity cache');
 check(dashboard.includes('mustClearOfflinePhotoDirectory(response.status)')&&dashboard.includes('setOfflinePhotoOnly(false);setOfflinePhotoCustomers([]);')&&dashboard.includes('await clearOfflinePhotoCustomerDirectory().catch'),'Actual FIRE owner authorization denial revokes cached customer listing before any offline fallback');
 await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+passed+' actual browser IndexedDB offline photo checks.');
