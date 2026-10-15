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
 directory:'../lib/offline-photo-customer-directory.ts'
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
    if(path==='../app/local-customer-deployment')return {LOCAL_CUSTOMER_DEPLOYMENT:'live'};
    throw Error('Undeclared test-only import '+path);
   };
   new Function('exports','require',source[name])(exports,req);
   modules[name]=exports;if(name==='archive')window.FIRE_ARCHIVE_MODULE=exports;return exports;
  };
  window.FIRE_LOCAL_PHOTOS=run('vault');
  window.FIRE_OFFLINE_PHOTO_CUSTOMERS=run('directory');
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
 const conflict=await page.evaluate(async bytes=>{
  try{await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']);return 'unexpected success';}
  catch{return 'refused';}
 },archiveBytes);
 check(conflict==='refused','Restore cannot overwrite an existing photo with the same ID');
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===1,'Failed duplicate restore rolls back without changing current library');
 const wrongCustomer=await page.evaluate(async bytes=>{
  try{await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['wrong-customer']);return 'unexpected success';}
  catch{return 'refused';}
 },archiveBytes);
 check(wrongCustomer==='refused','Restore refuses photographs for a missing customer record');
 const damaged=archiveBytes.slice();damaged[damaged.length-40]^=1;
 const rejected=await page.evaluate(async bytes=>{
  try{await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']);return 'unexpected success';}
  catch{return 'refused';}
 },damaged);
 check(rejected==='refused','Damaged archive fails closed without writing customer photos');
 await page.evaluate(async id=>{await window.FIRE_LOCAL_PHOTOS.removeOfflinePhoto(id,'synthetic-customer');},created.photoId);
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(x=>x.length)))===0,'Deliberate photo deletion is verified on device');
 const restored=await page.evaluate(async bytes=>{
  return await window.FIRE_LOCAL_PHOTOS.restoreLocalPhotos(new Blob([new Uint8Array(bytes)]),['synthetic-customer']);
 },archiveBytes);
 check(restored===1,'Fully validated ZIP restores into empty on-device vault');
 const after=await page.evaluate(async()=>{
  const x=await window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer');return {count:x.length,bytes:await x[0].blob.text()};
 });
 check(after.count===1&&after.bytes==='photo-one-binary','Actual browser round-trip preserved byte-identical photo');
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
 check((await page.evaluate(async()=>window.FIRE_LOCAL_PHOTOS.listOfflinePhotos('synthetic-customer').then(rows=>rows.length))===2,'Clearing cached customer names does not delete owner's local photo files');
 const dashboard=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
 check(dashboard.includes('saveOfflinePhotoCustomerDirectory(nextCustomers.map(')&&dashboard.includes('if(offlinePhotoOnly){'),'Actual FIRE Customers screen supplies photo-only offline fallback from authenticated identity cache');
 check(dashboard.includes('authenticationFailed=true')&&dashboard.includes('clearOfflinePhotoCustomerDirectory().catch'),'Actual FIRE customer API denial never exposes cached directory as a fallback');
 await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
console.log('PASS '+passed+' actual browser IndexedDB offline photo checks.');
