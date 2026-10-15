// Gate 10 local physical rollback rehearsal.  Never opens a remote D1 or R2,
// executes Wrangler, calls Stripe, or reads actual customer/financial records.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync, readdirSync, readFileSync, copyFileSync, rmSync, existsSync, constants} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {inspectCandidatePreflight} from './audit-local-schema.mjs';

const root=resolve('.');
const target=process.env.FIRE_SYNTHETIC_TARGET;
assert.ok(['live','doomsday','staging'].includes(target),'CI must explicitly name one coordinated candidate');
const migrations=readdirSync(join(root,'drizzle')).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
assert.ok(migrations.length>=20,'Expected the target-specific migration sequence');
assert.deepEqual(migrations.map(name=>Number(name.slice(0,4))),Array.from({length:migrations.length},(_,i)=>i));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const migrationFingerprint=sha(Buffer.from(JSON.stringify(migrations.map(name=>
  [name,sha(readFileSync(join(root,'drizzle',name)))]))));
const workspace=mkdtempSync(join(tmpdir(),`fire-physical-rollback-${target}-`));
const sourcePath=join(workspace,'active.synthetic.sqlite');
const backupPath=join(workspace,'sealed.synthetic.sqlite');
const restoredPath=join(workspace,'restored.synthetic.sqlite');
const check=database=>{
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok','SQLite integrity check failed');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[],'Foreign-key inconsistency detected');
};
function state(database){
  return {
    objects:database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
    journal:database.prepare('SELECT name FROM d1_migrations ORDER BY id').all().map(row=>row.name),
    customers:database.prepare('SELECT id,name,created_at FROM customers ORDER BY id').all(),
    estimates:database.prepare('SELECT id,customer_id,total_cents,deposit_cents,status FROM estimates ORDER BY id').all(),
    payments:database.prepare('SELECT id,estimate_id,type,amount_cents,status,provider_id FROM payments ORDER BY id').all(),
  };
}
function reviewSnapshot(file,seal,expectedTarget){
  if(expectedTarget!==seal.target)throw Error('Rollback BLOCKED: destination does not match sealed candidate');
  if(migrationFingerprint!==seal.migrationFingerprint)throw Error('Rollback BLOCKED: migration fingerprint changed');
  if(!existsSync(file) || sha(readFileSync(file))!==seal.sha256)throw Error('Rollback BLOCKED: physical backup hash mismatch');
  const database=new DatabaseSync(file,{readOnly:true});
  try{
    check(database);
    assert.deepEqual(state(database).journal,migrations,'Rollback BLOCKED: migration journal mismatch');
    assert.equal(inspectCandidatePreflight(database,root).candidatePreflightClear,true,
      'Rollback BLOCKED: schema or payment-ledger preflight failed');
    assert.deepEqual(state(database),seal.recordedState,'Rollback BLOCKED: evidence/backup mismatch');
  }finally{database.close();}
}
function restoreOnlyToEmpty(file,seal,destination,targetName){
  reviewSnapshot(file,seal,targetName);
  assert.ok(!existsSync(destination),'Rollback BLOCKED: destination must be empty (never overwrite)');
  copyFileSync(file,destination,constants.COPYFILE_EXCL);
}
try{
  const database=new DatabaseSync(sourcePath);
  database.exec('PRAGMA foreign_keys=ON');
  for(const name of migrations)database.exec(readFileSync(join(root,'drizzle',name),'utf8'));
  database.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT)');
  for(const name of migrations)database.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);
  database.exec(`INSERT INTO customers(id,name,created_at) VALUES ('customer-ci','Synthetic rollback customer','2026-10-14');
    INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at)
      VALUES ('estimate-ci','customer-ci','completed',10000,10000,5000,'2026-10-14');
    INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES
      ('payment-ci','estimate-ci','Cash',10000,'paid','manual-ci','2026-10-14'),
      ('tip-ci','estimate-ci','Tip',800,'paid','tip-ci','2026-10-14');`);
  check(database);
  assert.equal(inspectCandidatePreflight(database,root).candidatePreflightClear,true,'Synthetic source must pass release schema preflight');
  const before=state(database);
  // SQLite's VACUUM INTO makes a complete standalone physical file, not a
  // JSON records export. The test assumes writers have been quiesced locally.
  database.exec(`VACUUM INTO '${backupPath.replaceAll("'","''")}'`);
  const seal={
    target,
    migrationFingerprint,
    sha256:sha(readFileSync(backupPath)),
    recordedState:before,
    productionReady:false,
    remoteEvidence:false,
  };
  reviewSnapshot(backupPath,seal,target);
  assert.equal(existsSync(restoredPath),false);
  // Simulate malicious or mistaken restore requests: all must leave target absent.
  assert.throws(()=>restoreOnlyToEmpty(backupPath,seal,restoredPath,
    target==='live'?'doomsday':'live'),/destination does not match/);
  assert.equal(existsSync(restoredPath),false);
  const corrupted=join(workspace,'tampered.synthetic.sqlite');
  copyFileSync(backupPath,corrupted);
  const {appendFileSync}=await import('node:fs');
  appendFileSync(corrupted,'TAMPER');
  assert.throws(()=>restoreOnlyToEmpty(corrupted,seal,restoredPath,target),/hash mismatch/);
  assert.equal(existsSync(restoredPath),false);
  const forged={...seal,migrationFingerprint:'0'.repeat(64)};
  assert.throws(()=>restoreOnlyToEmpty(backupPath,forged,restoredPath,target),/migration fingerprint changed/);
  assert.equal(existsSync(restoredPath),false);

  // A bad cutover can change payments, drop a safety index, and lose journal
  // metadata. Rollback must restore all three, not just app-visible records.
  database.exec("UPDATE payments SET amount_cents=9999 WHERE id='payment-ci'");
  database.exec('DROP INDEX idx_payments_stripe_provider_unique');
  database.prepare('DELETE FROM d1_migrations WHERE name=?').run(migrations.at(-1));
  check(database);
  const broken=state(database);
  assert.notDeepEqual(broken,before,'Fault injection unexpectedly left original database unchanged');
  assert.equal(inspectCandidatePreflight(database,root).candidatePreflightClear,false,
    'Corrupted SQL schema/journal must stop release preflight');
  database.close();
  restoreOnlyToEmpty(backupPath,seal,restoredPath,target);
  const recovered=new DatabaseSync(restoredPath,{readOnly:true});
  try{
    check(recovered);
    assert.deepEqual(state(recovered),before,'Restored physical database differs in schema, indexes, journal or money');
    assert.equal(inspectCandidatePreflight(recovered,root).candidatePreflightClear,true,
      'Recovered database failed release preflight');
  }finally{recovered.close();}
  assert.equal(sha(readFileSync(restoredPath)),seal.sha256,'Restored file bytes differ from sealed snapshot');
  assert.throws(()=>restoreOnlyToEmpty(backupPath,seal,restoredPath,target),/destination must be empty/,
    'Refuse to overwrite a previously restored destination');
  assert.equal(sha(readFileSync(backupPath)),seal.sha256,'Read-only snapshot mutated during recovery');
  console.log(`PASS: ${target} ${migrations.length} target migrations; full physical SQLite snapshot, schema/index/payment/journal rollback, byte-for-byte seal, target/hash/migration guards, non-overwrite; no remote access or deployments.`);
}finally{
  rmSync(workspace,{recursive:true,force:true});
}
