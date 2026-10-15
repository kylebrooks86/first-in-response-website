/** Tests shared read-only reconciliation against disposable native D1/R2. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
// pnpm isolates transitive dependencies, so miniflare may be available
// through Wrangler even when it is not directly resolvable from this test.
const resolveMiniflare = () => {
  const override = process.env.FIRE_PREFLIGHT_MINIFLARE_MODULE;
  if (override) return require(override).Miniflare;
  try { return require('miniflare').Miniflare; }
  catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    const fromWrangler = createRequire(require.resolve('wrangler'));
    return fromWrangler('miniflare').Miniflare;
  }
};
const Miniflare = resolveMiniflare();
const source=resolve(new URL('..',import.meta.url).pathname),target=readFileSync(join(source,'app/local-customer-deployment.ts'),'utf8').match(/= '(\w+)'/)[1];
const temp=mkdtempSync(join(tmpdir(),'fire-photo-reconciliation-'));let passed=0;const checks=[];
const check=async(name,fn)=>{await fn();passed++;checks.push(name);};
const compile=(path,imports)=>{const module={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(imports,module,module.exports);return module.exports;};
const {inspectPhotoStorage}=compile(join(source,'lib/photo-storage-integrity.ts'),()=>{throw Error('Unexpected dependency');});
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'synthetic-photo-integrity-'+target},r2Buckets:{BUCKET:'synthetic-photo-integrity-'+target},d1Persist:false,r2Persist:false});
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
 await db.prepare('CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT)').run();
 await db.prepare('CREATE TABLE customer_photos(id TEXT PRIMARY KEY,customer_id TEXT,category TEXT,caption TEXT,filename TEXT,content_type TEXT,size_bytes INTEGER,object_key TEXT,created_at TEXT)').run();
 await db.prepare("INSERT INTO customers VALUES('customer-1','Synthetic')").run();
 const bytes=Buffer.from('synthetic-image-bytes'),key='customers/customer-1/photo-1.png';
 await bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
 await db.prepare("INSERT INTO customer_photos VALUES('photo-1','customer-1','before',NULL,'before.png','image/png',?,?,'2026-10-14T00:00:00Z')").bind(bytes.length,key).run();
 const reader={all:async sql=>{assert.match(sql,/^SELECT /);return (await db.prepare(sql).all()).results;}};
 const inspect=(r=reader,b=bucket)=>inspectPhotoStorage(r,{list:a=>b.list(a),head:k=>b.head(k),put(){throw Error('Forbidden write');},delete(){throw Error('Forbidden deletion');}});
 await check('native referenced photo metadata and R2 match',async()=>{const r=await inspect();assert.equal(r.referencedMetadataMatches,true);assert.equal(r.metadataPhotoCount,1);assert.equal(r.storageObjectCount,1);assert.deepEqual(r.issues,[]);});
 await check('healthy scan does not claim recovery or atomicity',async()=>{const r=await inspect();assert.equal(r.recoveryReady||r.snapshotAtomic||r.photoBytesVerified||r.cleanupAuthorized,false);assert.equal(r.writesAttempted,0);});
 await bucket.put('customers/customer-1/orphan-1.png',bytes,{httpMetadata:{contentType:'image/png'}});
 await check('uncertain-save orphan retained and reported',async()=>{const r=await inspect();assert.equal(r.retainedUnreferencedObjects.length,1);assert.equal(r.retainedUnreferencedObjects[0].key,'customers/customer-1/orphan-1.png');assert.deepEqual(Buffer.from(await (await bucket.get('customers/customer-1/orphan-1.png')).arrayBuffer()),bytes);});
 await bucket.delete(key);
 await check('missing referenced bytes block matching result',async()=>{const r=await inspect();assert.equal(r.referencedMetadataMatches,false);assert.equal(r.issues[0].reason,'missing_object');});
 await bucket.put(key,Buffer.from('wrong'),{httpMetadata:{contentType:'image/jpeg'}});
 await check('size and MIME conflicts are surfaced',async()=>{const r=await inspect();assert.deepEqual(r.issues.map(x=>x.reason),['size_mismatch','content_type_mismatch']);});
 await bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
 await db.prepare("UPDATE customer_photos SET customer_id='other-owner'").run();
 await check('wrong customer relationship fails closed',async()=>{assert.equal((await inspect()).issues[0].reason,'invalid_metadata_or_relationship');});
 await db.prepare("UPDATE customer_photos SET customer_id='customer-1',object_key='customers/customer-1/photo-1.png/../other'").run();
 await check('unsafe object path rejected without reading arbitrary bytes',async()=>{const r=await inspect();assert.equal(r.issues[0].reason,'invalid_metadata_or_relationship');});
 await db.prepare('UPDATE customer_photos SET object_key=?').bind(key).run();
 const base=(await reader.all('SELECT id,customer_id AS customerId,object_key AS objectKey,content_type AS contentType,size_bytes AS sizeBytes FROM customer_photos'))[0];
 await check('duplicate object references rejected',async()=>{const r=await inspect({all:async sql=>sql.includes('customer_photos')?[base,{...base,id:'photo-2'}]:[{id:'customer-1'}]});assert.equal(r.referencedMetadataMatches,false);assert.ok(r.issues.some(x=>x.reason==='invalid_metadata_or_relationship'));});
 await check('record drift invalidates apparently complete scan',async()=>{let calls=0;const r=await inspect({all:async sql=>sql.includes('customer_photos')?[(++calls===1?base:{...base,sizeBytes:1})]:[{id:'customer-1'}]});assert.equal(r.observationsStable,false);assert.equal(r.referencedMetadataMatches,false);});
 await check('referenced R2 object drift invalidates scan',async()=>{const r=await inspect(reader,{list:a=>bucket.list(a),head:async k=>({...await bucket.head(k),etag:'changed-after-list'})});assert.ok(r.issues.some(x=>x.reason==='object_changed_during_scan'));assert.equal(r.referencedMetadataMatches,false);});
 await check('incomplete inventory cannot produce a report',async()=>{await assert.rejects(inspect(reader,{list:async()=>({objects:[],truncated:true}),head:k=>bucket.head(k)}),/complete coverage/);});
 await check('repeated pagination cursor fails closed',async()=>{await assert.rejects(inspect(reader,{list:async()=>({objects:[],truncated:true,cursor:'repeat'}),head:k=>bucket.head(k)}),/complete coverage/);});
 await check('storage read failure cannot imply complete coverage',async()=>{await assert.rejects(inspect(reader,{list:async()=>{throw Error('Synthetic interrupted inventory');},head:k=>bucket.head(k)}),/interrupted inventory/);});
 await check('scan rejects excessive metadata',async()=>{await assert.rejects(inspect({all:async sql=>sql.includes('customer_photos')?Array(5001).fill(base):[{id:'customer-1'}]}),/scan limit/);});
 let user={email:'kylebrooks8605@gmail.com'};const env={DB:db,BUCKET:bucket};
 const zipModule=compile(join(source,'lib/photo-storage-zip.ts'),()=>{throw Error('Unexpected ZIP dependency');});
 const storageModule=compile(join(source,'lib/photo-storage-archive.ts'),id=>id.endsWith('photo-storage-integrity')?{inspectPhotoStorage}:id.endsWith('photo-storage-zip')?zipModule:(()=>{throw Error('Unexpected archive dependency');})());
 const load=path=>compile(path,id=>id==='cloudflare:workers'?{env}:id.endsWith('chatgpt-auth')?{getChatGPTUser:async()=>user}:id.endsWith('photo-storage-archive')?storageModule:id.endsWith('photo-storage-integrity')?{inspectPhotoStorage}:(()=>{throw Error('Unexpected import '+id)})());
 const route=load(join(source,'app/api/backup/photos/integrity/route.ts'));
 await check('actual owner route returns no-store read-only report',async()=>{const r=await route.GET();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).writesAttempted,0);});
 user=null;await check('actual route rejects unauthenticated access',async()=>assert.equal((await route.GET()).status,401));
 user={email:'other@example.invalid'};await check('actual route rejects different owner',async()=>assert.equal((await route.GET()).status,401));
 user={email:'kylebrooks8605@gmail.com'};env.BUCKET=null;await check('actual route preserves records when storage unavailable',async()=>assert.equal((await route.GET()).status,503));env.BUCKET=bucket;
 env.BUCKET={head:k=>bucket.head(k),list:async()=>{throw Error('Synthetic lost read acknowledgement');}};
 await check('actual route reports uncertain inspection without retry or writes',async()=>{const r=await route.GET();assert.equal(r.status,503);assert.equal((await r.json()).inspectionUncertain,true);});env.BUCKET=bucket;
 await check('read-only inspection leaves native metadata and bytes unchanged',async()=>{const before=await reader.all('SELECT * FROM customer_photos'),digest=createHash('sha256').update(Buffer.from(await (await bucket.get(key)).arrayBuffer())).digest('hex');await inspect();assert.deepEqual(await reader.all('SELECT * FROM customer_photos'),before);assert.equal(createHash('sha256').update(Buffer.from(await (await bucket.get(key)).arrayBuffer())).digest('hex'),digest);});
 // Exercise the real existing archive exporter and recover only its referenced synthetic image into a fresh native bucket.
 await check('actual archive export retains byte-identical referenced photo',async()=>{
  const archive=await load(join(source,'app/api/backup/photos/route.ts')).GET();assert.equal(archive.status,200);
  const file=join(temp,'synthetic.zip');writeFileSync(file,Buffer.from(await archive.arrayBuffer()));
  const manifestResult=spawnSync('unzip',['-p',file,'manifest.json'],{encoding:'utf8'});assert.equal(manifestResult.status,0);const manifest=JSON.parse(manifestResult.stdout);
  assert.equal(manifest.scope,'referenced-photos-only');assert.equal(manifest.unreferencedStorageFilesIncluded,false);assert.equal(manifest.atomicSnapshot,false);assert.equal(manifest.requiresSeparateRecordsBackup,true);
  assert.equal(manifest.photoCount,1);assert.deepEqual(manifest.missingPhotoIds,[]);assert.equal(manifest.photos[0].objectKey,key);
  const entry='photos/customer-1/photo-1-before.png',unpacked=spawnSync('unzip',['-p',file,entry]);assert.equal(unpacked.status,0);assert.deepEqual(unpacked.stdout,bytes);
  const recovery=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',r2Buckets:{BUCKET:'synthetic-photo-recovery-'+target},r2Persist:false});
  try{const destination=await recovery.getR2Bucket('BUCKET');await destination.put(key,unpacked.stdout,{httpMetadata:{contentType:manifest.photos[0].contentType}});assert.deepEqual(Buffer.from(await (await destination.get(key)).arrayBuffer()),bytes);}finally{await recovery.dispose();}
  // This fixture proves export/byte transport only. Existing archive excludes orphan bytes; it cannot be a complete storage backup.
  assert.ok(await bucket.head('customers/customer-1/orphan-1.png'));
 });
 await check('legacy photo archive rejects missing referenced bytes BEFORE a successful ZIP download',async()=>{
  await bucket.delete(key);
  try {
   const response=await load(join(source,'app/api/backup/photos/route.ts')).GET();
   assert.equal(response.status,409);
   assert.equal(response.headers.get('content-type'),'application/json');
   assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal((await response.json()).archiveIncomplete,true);
  } finally {await bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});}
 });
 await check('legacy photo archive rejects incorrect stored byte length without touching either store',async()=>{
  await db.prepare('UPDATE customer_photos SET size_bytes=size_bytes+1 WHERE id=?').bind('photo-1').run();
  try {
   const response=await load(join(source,'app/api/backup/photos/route.ts')).GET();
   assert.equal(response.status,409);
   assert.equal((await response.json()).archiveIncomplete,true);
   assert.deepEqual(Buffer.from(await (await bucket.get(key)).arrayBuffer()),bytes);
  } finally {await db.prepare('UPDATE customer_photos SET size_bytes=? WHERE id=?').bind(bytes.length,'photo-1').run();}
 });
 await check('legacy photo archive rejects R2 content-type mismatch without deleting originals',async()=>{
  await bucket.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  try {
   const response=await load(join(source,'app/api/backup/photos/route.ts')).GET();
   assert.equal(response.status,409);
   assert.equal((await response.json()).archiveIncomplete,true);
  } finally {await bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});}
 });
 await check('legacy photo archive denies success when HEAD verification fails',async()=>{
  env.BUCKET={head:async()=>{throw Error('Synthetic R2 HEAD outage');}};
  try {
   const response=await load(join(source,'app/api/backup/photos/route.ts')).GET();
   assert.equal(response.status,503);
   assert.equal((await response.json()).archiveUncertain,true);
  } finally {env.BUCKET=bucket;}
 });
 await check('legacy photo archive aborts if R2 object vanishes after successful preflight',async()=>{
  env.BUCKET={head:k=>bucket.head(k),get:async()=>null};
  try {
   const response=await load(join(source,'app/api/backup/photos/route.ts')).GET();
   assert.equal(response.status,200);
   await assert.rejects(response.arrayBuffer(),/disappeared or changed/);
  } finally {env.BUCKET=bucket;}
 });
 await check('actual archive aborts interrupted byte reads and preserves source',async()=>{
  env.BUCKET={head:k=>bucket.head(k),get:async()=>{throw Error('Synthetic interrupted export');}};
  try{const archive=await load(join(source,'app/api/backup/photos/route.ts')).GET();await assert.rejects(archive.arrayBuffer(),/interrupted export/);}finally{env.BUCKET=bucket;}
  assert.deepEqual(Buffer.from(await (await bucket.get(key)).arrayBuffer()),bytes);
 });
 let completeFile;
 await check('actual complete archive covers referenced and unreferenced native bytes',async()=>{
  const response=await load(join(source,'app/api/backup/photos/storage/route.ts')).GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  completeFile=join(temp,'complete.zip');writeFileSync(completeFile,Buffer.from(await response.arrayBuffer()));
  const valid=spawnSync('python3',[join(source,'scripts/validate-photo-storage-archive.py'),completeFile],{encoding:'utf8'});assert.equal(valid.status,0,valid.stdout+valid.stderr);const result=JSON.parse(valid.stdout);assert.equal(result.declaredNamespaceCoverageValidated,true);assert.equal(result.cryptographicChecksumsVerified,true);assert.equal(result.unreferencedObjectsPreserved,1);assert.equal(result.objectsValidated,2);assert.equal(result.restoreExecutionAuthorized,false);
 });
 await check('complete source archive bytes transport to an empty native bucket',async()=>{
  const m=JSON.parse(spawnSync('unzip',['-p',completeFile,'manifest.json'],{encoding:'utf8'}).stdout),destination=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',r2Buckets:{BUCKET:'synthetic-complete-recovery-'+target},r2Persist:false});
  try{const restored=await destination.getR2Bucket('BUCKET');for(const o of m.objects){const data=spawnSync('unzip',['-p',completeFile,o.archivePath]);assert.equal(data.status,0);await restored.put(o.objectKey,data.stdout,{httpMetadata:o.contentType?{contentType:o.contentType}:undefined});const recovered=Buffer.from(await (await restored.get(o.objectKey)).arrayBuffer());assert.equal(createHash('sha256').update(recovered).digest('hex'),o.sha256);}assert.equal((await restored.list()).objects.length,2);}finally{await destination.dispose();}
  assert.equal((await reader.all('SELECT * FROM customer_photos')).length,1); // No orphan metadata was invented.
 });
 for(const mode of ['checksum','missing-entry','extra-entry','duplicate-entry','unsafe-entry','owner','invented-orphan-record','duplicate-key','count','coverage','partial-photo','size','version','missing-photos','truncated'])await check('complete validator rejects '+mode,async()=>{
  const corrupt=join(temp,mode+'.zip');
  const py=spawnSync('python3',['-c',`import sys,json,zipfile,copy
src,dst,mode=sys.argv[1:]
with zipfile.ZipFile(src) as z:
 entries={n:z.read(n) for n in z.namelist()}
m=json.loads(entries['manifest.json'])
if mode=='checksum':m['objects'][0]['sha256']='0'*64
if mode=='missing-entry':del entries[m['objects'][0]['archivePath']]
if mode=='extra-entry':entries['objects/999999.bin']=b'extra'
if mode=='unsafe-entry':entries['../unsafe']=b'unsafe'
if mode=='owner':m['photos'][0]['customerId']='wrong-owner'
if mode=='invented-orphan-record':next(o for o in m['objects'] if o['association']=='unreferenced')['photoId']='invented-photo'
if mode=='duplicate-key':m['objects'][1]['objectKey']=m['objects'][0]['objectKey']
if mode=='count':m['objectCount']+=1
if mode=='coverage':m['coverageVerified']=False
if mode=='partial-photo':del m['photos'][0]['caption']
if mode=='size':m['objects'][0]['sizeBytes']+=1
if mode=='version':m['objects'][0]['version']=''
if mode=='missing-photos':m['photos']=[]
entries['manifest.json']=json.dumps(m).encode()
with zipfile.ZipFile(dst,'w',compression=zipfile.ZIP_STORED) as z:
 for n,b in entries.items():z.writestr(n,b)
 if mode=='duplicate-entry':z.writestr('manifest.json',entries['manifest.json'])
if mode=='truncated':
 with open(dst,'rb') as f:b=f.read()
 with open(dst,'wb') as f:f.write(b[:-25])
`,completeFile,corrupt,mode],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);
  const validation=spawnSync('python3',[join(source,'scripts/validate-photo-storage-archive.py'),corrupt],{encoding:'utf8'});assert.equal(validation.status,1,mode+':'+validation.stdout+validation.stderr);assert.equal(JSON.parse(validation.stdout).restoreExecutionAuthorized,false);
 });
 await check('complete export fails closed when referenced bytes are missing',async()=>{await bucket.delete(key);const response=await load(join(source,'app/api/backup/photos/storage/route.ts')).GET();assert.equal(response.status,503);await bucket.put(key,bytes,{httpMetadata:{contentType:'image/png'}});});
 await check('complete exporter aborts post-inventory object replacement',async()=>{const fake={list:a=>bucket.list(a),head:k=>bucket.head(k),get:async k=>({...await bucket.get(k),version:'synthetic-replacement'})};const response=await storageModule.exportCompletePhotoStorage(reader,fake);await assert.rejects(response.arrayBuffer(),/changed during export/);});
 await check('complete exporter aborts post-inventory metadata changes',async()=>{let calls=0;const drift={all:async sql=>{const result=await reader.all(sql);if(sql.includes('category,caption')){calls++;return calls===1?result:result.map(p=>({...p,caption:'Synthetic concurrent edit'}));}return result;}};const response=await storageModule.exportCompletePhotoStorage(drift,bucket);await assert.rejects(response.arrayBuffer(),/coverage changed/);});
 await check('new complete route denies non-owner and missing storage',async()=>{user=null;assert.equal((await load(join(source,'app/api/backup/photos/storage/route.ts')).GET()).status,401);user={email:'kylebrooks8605@gmail.com'};env.BUCKET=null;assert.equal((await load(join(source,'app/api/backup/photos/storage/route.ts')).GET()).status,503);env.BUCKET=bucket;});
 await check('legacy archive remains read-only validated without claiming complete namespace',async()=>{const response=await load(join(source,'app/api/backup/photos/route.ts')).GET(),file=join(temp,'legacy-final.zip');writeFileSync(file,Buffer.from(await response.arrayBuffer()));const r=spawnSync('python3',[join(source,'scripts/validate-photo-storage-archive.py'),file],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(r.stdout).declaredNamespaceCoverageValidated,false);});
 console.log(JSON.stringify({passed,total:checks.length,checks,target,nativeLocalD1R2:true,hostedRecoveryVerified:false,productionChanges:0},null,2));
}finally{await mf.dispose();rmSync(temp,{recursive:true,force:true});}
