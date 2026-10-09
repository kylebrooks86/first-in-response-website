import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';

const root=resolve(process.argv[2]||'.'),work=mkdtempSync(join(tmpdir(),'fire-photo-restore-test-'));
const photo={id:'photo-0001',customerId:'customer-0001',category:'before',filename:'before.jpg',contentType:'image/jpeg',sizeBytes:3,objectKey:'customers/customer-0001/photo-0001.jpg',createdAt:'2026-10-08'};
const entry='photos/customer-0001/photo-0001-before.jpg';
let count=0;
try {
 mkdirSync(join(work,'scripts'),{recursive:true});mkdirSync(join(work,'node_modules/wrangler/bin'),{recursive:true});
 copyFileSync(join(root,'scripts/restore-photo-archive.mjs'),join(work,'scripts/restore-photo-archive.mjs'));
 // The actual CLI runs against this local stand-in. It cannot call real Wrangler
 // or any remote database/bucket, even for the remote confirmation test cases.
 writeFileSync(join(work,'node_modules/wrangler/bin/wrangler.js'),`
 const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.FIRE_PHOTO_TEST_SQLITE);const a=process.argv.slice(2),mode=process.env.FIRE_PHOTO_TEST_MODE;
 fs.appendFileSync(process.env.FIRE_PHOTO_TEST_LOG,JSON.stringify(a)+'\\n');
 if(a[0]==='d1'){
  const sql=a[a.indexOf('--command')+1];
  if(sql.startsWith('SELECT id FROM customers')){
   if(mode==='bad-state'){console.log('[]');process.exit(0);}
   const customers=db.prepare('SELECT id FROM customers').all();
   const photos=db.prepare('SELECT id,customer_id AS customerId,object_key AS objectKey,size_bytes AS sizeBytes FROM customer_photos').all();
   console.log(JSON.stringify([{results:customers},{results:photos}]));process.exit(0);
  }
  if(sql.startsWith('INSERT')){db.exec(sql);if(mode==='insert-error'){console.error('Synthetic lost response AFTER COMMIT');process.exit(1);}console.log('{}');process.exit(0);}
  if(sql.startsWith('SELECT customer_id')){if(mode==='verify-error'){console.error('Synthetic verification error');process.exit(1);}
   const rows=db.prepare(sql).all();if(mode==='verify-mismatch'&&rows[0])rows[0].objectKey='different-key';console.log(JSON.stringify([{results:rows}]));process.exit(0);}
 }
 if(a[0]==='r2'&&a[2]==='get'){if(mode==='existing-object'){process.exit(0);}console.error('specified key does not exist');process.exit(1);}
 if(a[0]==='r2'&&a[2]==='put'){console.log('synthetic upload');process.exit(0);}
 console.error('Unexpected fixture operation');process.exit(99);
 `);
 const config={d1_databases:[{binding:'DB',database_name:'synthetic-photo-db',database_id:'11111111-1111-4111-8111-111111111111'}],r2_buckets:[{binding:'BUCKET',bucket_name:'synthetic-photo-bucket'}]};
 function test({mode='normal',photos=[photo],missing=[],entries=[[entry,'abc']],apply=false,extra=[],configOverride,expected=0,message,check}){
  count++;const dir=join(work,'case-'+count);mkdirSync(dir);const archive=join(dir,'archive.zip'),log=join(dir,'operations.jsonl'),configFile=join(dir,'config.json'),databaseFile=join(dir,'synthetic.sqlite');
  const db=new DatabaseSync(databaseFile);
  db.exec("CREATE TABLE customers(id TEXT PRIMARY KEY);CREATE TABLE payments(id TEXT PRIMARY KEY,amount_cents INTEGER);INSERT INTO payments VALUES('preserved-payment',7500);CREATE TABLE customer_photos(id TEXT PRIMARY KEY,customer_id TEXT,category TEXT,caption TEXT,filename TEXT,content_type TEXT,size_bytes INTEGER,object_key TEXT,created_at TEXT);");
  if(mode!=='missing-customer')db.prepare('INSERT INTO customers VALUES(?)').run(photo.customerId);
  if(['existing-record','matching-record'].includes(mode))db.prepare('INSERT INTO customer_photos VALUES(?,?,?,?,?,?,?,?,?)').run(photo.id,mode==='existing-record'?'other-customer':photo.customerId,'before','Existing caption must remain','existing.jpg',photo.contentType,3,photo.objectKey,photo.createdAt);
  const financialBefore=JSON.stringify(db.prepare('SELECT * FROM payments').all()),photosBefore=JSON.stringify(db.prepare('SELECT * FROM customer_photos').all());db.close();
  writeFileSync(configFile,JSON.stringify(configOverride||config));
  const manifest={format:'fire-app-photo-archive',version:1,photoCount:photos.length-missing.length,missingPhotoIds:missing,photos};
  const zipped=spawnSync('python3',['-c',"import sys,json,zipfile; d=json.load(sys.stdin); z=zipfile.ZipFile(d['path'],'w'); z.writestr('manifest.json',json.dumps(d['manifest'])); [z.writestr(n,s) for n,s in d['entries']]; z.close()"],{input:JSON.stringify({path:archive,manifest,entries}),encoding:'utf8'});
  assert.equal(zipped.status,0,zipped.stderr);
  const args=[join(work,'scripts/restore-photo-archive.mjs'),'--archive',archive,'--config',configFile,...(extra.includes('--remote')?[]:['--local']),...(apply?['--apply']:[]),...extra];
  const run=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,FIRE_PHOTO_TEST_MODE:mode,FIRE_PHOTO_TEST_LOG:log,FIRE_PHOTO_TEST_SQLITE:databaseFile},timeout:10000});
  assert.equal(run.status,expected,run.stderr+run.stdout);if(message)assert.match(run.stderr+run.stdout,message);
  const operations=existsSync(log)?readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[];
  assert.equal(operations.filter(a=>a[0]==='r2'&&a[2]==='delete').length,0,'Recovery must never automatically delete ambiguous uploaded bytes.');
  const verifyDB=new DatabaseSync(databaseFile,{readOnly:true});
  assert.equal(JSON.stringify(verifyDB.prepare('SELECT * FROM payments').all()),financialBefore);
  if(['existing-record','matching-record'].includes(mode))assert.equal(JSON.stringify(verifyDB.prepare('SELECT * FROM customer_photos').all()),photosBefore);
  if(mode==='insert-error')assert.equal(verifyDB.prepare('SELECT COUNT(*) n FROM customer_photos').get().n,1,'Lost response can follow a committed metadata INSERT.');
  verifyDB.close();
  check?.(operations,run);
 }
 const noWrites=(ops)=>assert.equal(ops.filter(a=>a[0]==='r2'||a.includes('--yes')).length,0);
 test({message:/Dry run complete/,check:noWrites});
 test({apply:true,message:/Restored and verified/,check:ops=>assert.equal(ops.filter(a=>a[0]==='r2'&&a[2]==='put').length,1)});
 test({mode:'matching-record',apply:true,message:/Restored and verified/,check:ops=>{
  assert.equal(ops.filter(a=>a[0]==='r2'&&a[2]==='put').length,1);
  const sql=ops.filter(a=>a.includes('--yes')).map(a=>a[a.indexOf('--command')+1]);
  assert.equal(sql.length,1);assert.match(sql[0],/^INSERT OR IGNORE/);assert.ok(!sql[0].includes('UPDATE'));
 }});
 for(const mode of ['existing-record','missing-customer'])test({mode,apply:true,check:noWrites});
 test({mode:'existing-object',apply:true,message:/already exists/,check:ops=>assert.equal(ops.filter(a=>a[0]==='r2'&&a[2]==='put').length,0)});
 test({missing:[photo.id],entries:[],apply:true,check:noWrites});
 test({photos:[photo,{...photo}],expected:1,message:/duplicate photo IDs/,check:ops=>assert.equal(ops.length,0)});
 test({photos:[photo,{...photo,id:'photo-0002'}],expected:1,message:/duplicate object keys/,check:ops=>assert.equal(ops.length,0)});
 test({entries:[[entry,'abc'],[entry,'abc']],expected:1,message:/duplicate entry names/,check:ops=>assert.equal(ops.length,0)});
 test({entries:[[entry,'abc'],['../unsafe','x']],expected:1,message:/unsafe entry names/,check:ops=>assert.equal(ops.length,0)});
 test({mode:'bad-state',expected:1,message:/incomplete results/,check:noWrites});
 test({photos:[{...photo,sizeBytes:4}],apply:true,expected:1,message:/size does not match/,check:ops=>assert.equal(ops.filter(a=>a[0]==='r2'&&a[2]==='put').length,0)});
 for(const mode of ['insert-error','verify-error','verify-mismatch'])test({mode,apply:true,expected:1,message:/[Uu]ploaded object preserved/,check:ops=>assert.equal(ops.filter(a=>a[0]==='r2'&&a[2]==='put').length,1)});
 test({configOverride:{...config,r2_buckets:[]},expected:1,message:/non-placeholder DB and BUCKET/,check:ops=>assert.equal(ops.length,0)});
 test({apply:true,extra:['--remote','--confirm-bucket','synthetic-photo-bucket'],expected:1,message:/confirm-database/,check:ops=>assert.equal(ops.length,0)});
 test({extra:['--remote'],message:/Dry run complete/,check:noWrites});
 console.log('PASS: '+count+' actual photo-recovery CLI cases using synthetic ZIPs and local-only fake Wrangler; dry runs, target confirmation, conflicts, corrupt archives, interrupted writes, and non-destructive verification failures. No network/storage resources used.');
} finally {rmSync(work,{recursive:true,force:true});}
