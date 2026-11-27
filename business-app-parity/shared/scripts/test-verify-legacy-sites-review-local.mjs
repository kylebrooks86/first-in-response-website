/** Gate 7 — real disposable SQLite and private-file offline review verification.
 * Never fetch a provider, write LIVE data, or disclose synthetic row content.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {captureLegacySitesReviewReadOnly} from '../lib/legacy-sites-readonly-export.mjs';
import {verifyLocalLegacyReviewBytes} from './verify-legacy-sites-review-local.mjs';

const CLI=resolve('scripts/verify-legacy-sites-review-local.mjs');
const privateMarker='Synthetic Private Customer Should Never Appear in CLI Output';
const makeReview=async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL)');
  db.exec('CREATE TABLE customer_photos (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, object_key TEXT NOT NULL)');
  db.exec('CREATE INDEX synthetic_customer_photo_index ON customer_photos(customer_id)');
  db.prepare('INSERT INTO customers VALUES (?,?)').run('synthetic-customer',privateMarker);
  db.prepare('INSERT INTO customer_photos VALUES (?,?,?)').run('synthetic-photo','synthetic-customer','customers/synthetic-customer/synthetic-photo.jpg');
  let writes=0;
  const adapter={
   prepare(sql){
    if(!/^SELECT\b/i.test(sql)){writes++;throw Error('NO WRITES');}
    return {sql,all:async()=>({success:true,results:db.prepare(sql).all()})};
   },
   async batch(statements){
    if(statements.some(x=>!/^SELECT\b/i.test(x.sql))){writes++;throw Error('NO WRITES');}
    return statements.map(x=>({success:true,results:db.prepare(x.sql).all()}));
   }
  };
  const payload=await captureLegacySitesReviewReadOnly(adapter);
  assert.equal(writes,0);
  assert.equal(payload.completeBackup,false);
  return payload;
 }finally{db.close();}
};

test('actual ephemeral SQLite legacy review proves rows, index and schema only',async()=>{
 const source=await makeReview();
 const out=verifyLocalLegacyReviewBytes(Buffer.from(JSON.stringify(source)));
 assert.equal(out.result,'PASS_OFFLINE_LEGACY_RECORDS_DISPOSABLE_ROUNDTRIP');
 assert.equal(out.verifiedTables,2);
 assert.equal(out.verifiedRows,2);
 assert.equal(out.verifiedSchemaObjects,3);
 for(const field of ['connectedToCloudflare','connectedToSites','sourceDatabaseIdentityVerified',
  'migrationJournalProviderVerified','uploadedPhotoBytesVerified','independentPhotoArchivePaired',
  'sameInstantProviderSnapshotVerified','targetBoundRollbackVerified','hostedDataRestored',
  'gate7Accepted','gate10Accepted','liveReleaseAuthorized'])assert.equal(out[field],false,field);
 assert.equal(out.localFilesWritten,false);
 assert.ok(!JSON.stringify(out).includes(privateMarker));
 assert.ok(!JSON.stringify(out).includes('synthetic-photo.jpg'));
});

test('actual private CLI accepts complete owner-like review without printing records or filename',async()=>{
 const source=await makeReview();
 const folder=mkdtempSync(join(tmpdir(),'fire-private-gate7-'));
 const location=join(folder,'DO_NOT_PRINT_PRIVATE_RECORDS.json');
 try{
  writeFileSync(location,JSON.stringify(source),{mode:0o600});
  const before=readFileSync(location);
  const r=spawnSync(process.execPath,['--experimental-sqlite',CLI,location],
    {cwd:resolve('.'),encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,r.stderr);
  const receipt=JSON.parse(r.stdout);
  assert.equal(receipt.verifiedRows,2);
  assert.equal(receipt.gate7Accepted,false);
  assert.equal(receipt.liveReleaseAuthorized,false);
  assert.ok(!r.stdout.includes(privateMarker));
  assert.ok(!r.stdout.includes('DO_NOT_PRINT_PRIVATE_RECORDS'));
  assert.ok(!r.stdout.includes('synthetic-photo.jpg'));
  assert.deepEqual(readFileSync(location),before,'Input file must not change');
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('a changed private customer row with old digest is refused',async()=>{
 const source=await makeReview();
 const tampered=structuredClone(source);
 tampered.tables.customers[0].name='changed-customer';
 assert.throws(()=>verifyLocalLegacyReviewBytes(Buffer.from(JSON.stringify(tampered))),/NOT_VERIFIED/);
});

test('missing index, invalid receipt flags, non-JSON and oversized inputs fail shut',async()=>{
 const source=await makeReview();
 const scenarios=[
  {...source,schemaObjects:source.schemaObjects.filter(x=>x.type!=='index')},
  {...source,completeBackup:true},
  {...source,sourceD1UuidVerified:true},
  {...source,photoObjectBytesIncluded:true},
  {...source,recordsSelfCheckSHA256:'0'.repeat(64)},
 ];
 for(const changed of scenarios)
  assert.throws(()=>verifyLocalLegacyReviewBytes(Buffer.from(JSON.stringify(changed))),/NOT_VERIFIED/);
 for(const bytes of [Buffer.alloc(0),Buffer.from('{ customer PII'),Buffer.alloc(8_000_001,'a')])
  assert.throws(()=>verifyLocalLegacyReviewBytes(bytes),/NOT_VERIFIED/);
});

test('missing file and symlink cannot trick CLI into reading sensitive files',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'fire-private-gate7-'));
 try{
  const real=join(folder,'private.json');
  const link=join(folder,'link.json');
  writeFileSync(real,JSON.stringify(await makeReview()),{mode:0o600});
  symlinkSync(real,link);
  const run=path=>spawnSync(process.execPath,['--experimental-sqlite',CLI,path],
   {cwd:resolve('.'),encoding:'utf8',timeout:15000});
  const missing=run(join(folder,'missing-private.json'));
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/STOP: FIRE Gate7 private legacy review/);
  assert.ok(!missing.stderr.includes(folder));
  // O_NOFOLLOW is available on Linux GitHub Actions; Windows callers must use
  // an owner-controlled private path. Never resolve a link just to test data.
  if(process.platform==='linux'){
   const linked=run(link);
   assert.notEqual(linked.status,0);
   assert.ok(!linked.stdout.includes(privateMarker));
  }
 }finally{rmSync(folder,{recursive:true,force:true});}
});
