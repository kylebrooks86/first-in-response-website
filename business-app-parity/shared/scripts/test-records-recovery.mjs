import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {validateBackupRelationships,validateRefundIntegrity,validateRecordIdentities} from './records-backup-integrity.mjs';
const root=resolve('.'),work=mkdtempSync(join(tmpdir(),'fire-synthetic-records-'));
let checks=0;const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const schema=readdirSync(join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(join(root,'drizzle',f),'utf8')).join('\n');
const makeDb=path=>{const db=new DatabaseSync(path);db.exec(schema);return db;};
// No network action can occur in this synthetic backup/export test.
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Network/Stripe calls forbidden in records recovery tests');};
try{
 mkdirSync(join(work,'scripts'));mkdirSync(join(work,'node_modules/wrangler/bin'),{recursive:true});
 for(const file of ['restore-records-backup.mjs','validate-records-backup.mjs','records-backup-integrity.mjs'])copyFileSync(join(root,'scripts',file),join(work,'scripts',file));
 writeFileSync(join(work,'config.json'),JSON.stringify({d1_databases:[{binding:'DB',database_name:'synthetic-local-only',database_id:'11111111-1111-4111-8111-111111111111'}]}));
 // Mock Wrangler operates only on a temporary SQLite file; there are no cloud bindings.
 writeFileSync(join(work,'node_modules/wrangler/bin/wrangler.js'),`const fs=require('node:fs'),{DatabaseSync}=require('node:sqlite');const a=process.argv.slice(2);if(a.includes('--remote')||!a.includes('--local'))throw Error('Remote actions forbidden');const value=x=>a[a.indexOf(x)+1],db=new DatabaseSync(value('--persist-to'));db.exec('PRAGMA foreign_keys=ON');if(a.includes('--command')){console.log(JSON.stringify([{results:db.prepare(value('--command')).all()}]));}else{const text=fs.readFileSync(value('--file'),'utf8');let quoted=false,start=0,n=0;for(let i=0;i<text.length;i++){if(text[i]==="'"){if(quoted&&text[i+1]==="'"){i++;continue;}quoted=!quoted;}if(text[i]===';'&&!quoted){db.exec(text.slice(start,i+1));start=i+1;n++;if(process.env.FIRE_SYNTHETIC_INTERRUPT_AFTER&&n===Number(process.env.FIRE_SYNTHETIC_INTERRUPT_AFTER))throw Error('Synthetic interruption after committed prefix');}}console.log('Synthetic local apply complete');}db.close();`);
 const sourceDb=makeDb(join(work,'source.db'));
 sourceDb.exec(`INSERT INTO customers(id,name,created_at) VALUES('customer','Synthetic QA','2026-10-09');
 INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('job','customer','completed',10000,10000,5000,'2026-10-09');
 INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES
 ('payment','job','Cash',10000,'paid','cash-fixture','2026-10-09'),
 ('tip','job','Tip',1000,'paid','tip-fixture','2026-10-09'),
 ('partial-ledger','job','Refund',-2500,'paid','refund:payment:partial','2026-10-09'),
 ('tip-ledger','job','Tip Refund',-200,'paid','refund:tip:tip-partial','2026-10-09');
 INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,provider_refund_id,created_at) VALUES
 ('partial','payment','job',2500,'manual','succeeded',NULL,'2026-10-09'),
 ('tip-partial','tip','job',200,'stripe','succeeded','re_synthetic_tip','2026-10-09'),
 ('pending','payment','job',1000,'stripe','pending',NULL,'2026-10-09'),
 ('failed','payment','job',9999,'stripe','failed','re_synthetic_failed','2026-10-09');`);
 const adapter=db=>({prepare(query){return {query,args:[],bind(...args){this.args=args;return this;},async all(){return {results:db.prepare(query).all(...this.args)};}};},async batch(statements){return statements.map(s=>({results:db.prepare(s.query).all(...s.args)}));}});
 globalThis.__recordsRecoveryDb=adapter(sourceDb);
 const raw=readFileSync(join(root,'app/api/backup/route.ts'),'utf8');
 const ast=ts.createSourceFile('route.ts',raw,ts.ScriptTarget.Latest,true);
 const helpers=['validateBackupRelationships','validateRefundIntegrity'].map(name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(ast)).join('\n');
 const semantics=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule('const isRecord=v=>!!v&&typeof v==="object"&&!Array.isArray(v);\n'+helpers+'\nexport {validateBackupRelationships,validateRefundIntegrity};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
 const source='const env={get DB(){return globalThis.__recordsRecoveryDb;}};\n'+raw.replace(/^import .*?;\n/gm,'').replace(/async function authorized\(\) \{[\s\S]*?\n\}/,'async function authorized(){return true;}');
 const backupApi=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
 const exported=await backupApi.GET();equal(exported.status,200);const backup=await exported.json();equal(backup.tables.payment_refunds.length,4);equal(validateRefundIntegrity(backup.tables),null);
 const backupPath=join(work,'backup.json');const save=payload=>writeFileSync(backupPath,JSON.stringify(payload));save(backup);
 const invoke=(file,args=[],env={})=>spawnSync(process.execPath,[join(work,'scripts',file),...args],{cwd:work,encoding:'utf8',env:{...process.env,...env},maxBuffer:8*1024*1024});
 const validate=()=>invoke('validate-records-backup.mjs',[backupPath]);
 const restore=(path,apply=true,env={})=>invoke('restore-records-backup.mjs',['--backup',backupPath,'--config',join(work,'config.json'),'--local','--persist-to',path,...(apply?['--apply']:[])],env);
 equal(validate().status,0);
 const targetPath=join(work,'target.db');makeDb(targetPath).close();
 let result=restore(targetPath,false);equal(result.status,0,result.stderr);equal(new DatabaseSync(targetPath).prepare('SELECT COUNT(*) n FROM customers').get().n,0,'dry run writes nothing');
 result=restore(targetPath);equal(result.status,0,result.stderr);assert.match(result.stdout,/restoredAndVerified/);checks++;
 const target=new DatabaseSync(targetPath);globalThis.__recordsRecoveryDb=adapter(target);const reexport=await (await backupApi.GET()).json();
 for(const table of ['customers','estimates','payments','payment_refunds'])equal(reexport.tables[table],backup.tables[table],`${table} round trip`);
 equal(target.prepare("SELECT SUM(amount_cents) n FROM payments WHERE type NOT IN ('Tip','Tip Refund')").get().n,7500);equal(target.prepare("SELECT SUM(amount_cents) n FROM payments WHERE type IN ('Tip','Tip Refund')").get().n,800);
 result=restore(targetPath);equal(result.status,0,result.stderr);assert.match(result.stdout,/Nothing to restore/);checks++;equal(target.prepare('SELECT COUNT(*) n FROM payment_refunds').get().n,4,'retry does not duplicate requests');
 // Existing mutable records survive restoration; immutable conflicts fail before writes.
 target.exec("UPDATE customers SET name='Newer customer name' WHERE id='customer'");result=restore(targetPath);equal(result.status,0,result.stderr);equal(target.prepare("SELECT name FROM customers WHERE id='customer'").get().name,'Newer customer name');
 target.exec("UPDATE payments SET amount_cents=9000 WHERE id='payment'");result=restore(targetPath);assert.notEqual(result.status,0);checks++;assert.match(result.stderr,/conflicts/);checks++;target.exec("UPDATE payments SET amount_cents=10000 WHERE id='payment'");
 const variants=[
 ['missing customer',t=>t.estimates[0].customer_id='missing'],
 ['missing payment',t=>t.payment_refunds[0].payment_id='missing'],
 ['refund ownership',t=>{t.estimates.push({...t.estimates[0],id:'other-job'});t.payment_refunds[0].estimate_id='other-job';}],
 ['over-reserved',t=>t.payment_refunds.find(r=>r.id==='pending').amount_cents=7501],
 ['missing ledger',t=>t.payments=t.payments.filter(r=>r.id!=='partial-ledger')],
 ['mismatched ledger',t=>t.payments.find(r=>r.id==='partial-ledger').amount_cents=-2501],
 ['wrong tip ledger type',t=>t.payments.find(r=>r.id==='tip-ledger').type='Refund'],
 ['orphan ledger',t=>t.payment_refunds=t.payment_refunds.filter(r=>r.id!=='partial')],
 ['duplicate provider refund',t=>t.payment_refunds[3].provider_refund_id='re_synthetic_tip'],
 ['duplicate ledger provider',t=>t.payments.push({...t.payments.find(r=>r.id==='partial-ledger'),id:'duplicate-ledger'})],
 ['duplicate record',t=>t.customers.push({...t.customers[0]})],
 ['malformed refund collection',t=>t.payment_refunds={}],
 ];
 for(const [name,mutate] of variants){
  const bad=structuredClone(backup);mutate(bad.tables);save(bad);
  equal(validateRefundIntegrity(bad.tables),semantics.validateRefundIntegrity(bad.tables),`${name}: in-app refund semantics`);
  equal(validateBackupRelationships(bad.tables),semantics.validateBackupRelationships(bad.tables),`${name}: in-app relationships`);
  assert.notEqual(validate().status,0,`${name}: validator must reject`);checks++;
  const untouched=join(work,'bad-'+checks+'.db');const empty=makeDb(untouched);const before=empty.prepare('SELECT COUNT(*) n FROM customers').get().n;result=restore(untouched);assert.notEqual(result.status,0,`${name}: restore must reject`);checks++;equal(empty.prepare('SELECT COUNT(*) n FROM customers').get().n,before,`${name}: no partial writes`);empty.close();
 }
 save(backup);
 // Preserved target reservations also count toward the recovered payment budget.
 target.exec("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES('newer-pending','payment','job',7000,'manual','pending','2026-10-09')");result=restore(targetPath);assert.notEqual(result.status,0);checks++;assert.match(result.stderr,/reservations exceed/);checks++;target.exec("DELETE FROM payment_refunds WHERE id='newer-pending'");
 // An interruption may leave payments restored before requests. Full-backup retry repairs this prefix.
 const interruptedPath=join(work,'interrupted.db');makeDb(interruptedPath).close();
 result=restore(interruptedPath,true,{FIRE_SYNTHETIC_INTERRUPT_AFTER:'6'});assert.notEqual(result.status,0);checks++;assert.match(result.stderr,/safe to inspect and retry/);checks++;
 const interrupted=new DatabaseSync(interruptedPath);equal(interrupted.prepare('SELECT COUNT(*) n FROM customers').get().n,1);equal(interrupted.prepare('SELECT COUNT(*) n FROM payments').get().n,4);equal(interrupted.prepare('SELECT COUNT(*) n FROM payment_refunds').get().n,0);
 result=restore(interruptedPath);equal(result.status,0,result.stderr);equal(interrupted.prepare('SELECT COUNT(*) n FROM payment_refunds').get().n,4);equal(interrupted.prepare('SELECT SUM(amount_cents) n FROM payments').get().n,8300);result=restore(interruptedPath);equal(result.status,0,result.stderr);
 // Verified older snapshots may omit optional recovery/refund tables and newer columns.
 const older=structuredClone(backup.tables);delete older.payment_refunds;delete older.invoice_items;delete older.invoice_revisions;delete older.payment_checkout_sessions;older.payments=older.payments.filter(r=>!String(r.provider_id).startsWith('refund:'));
 for(const row of older.estimates)for(const field of ['appreciation_discount','additional_discount_type','additional_discount_value'])delete row[field];
 save({backup_format:'FIRE App live database snapshot',format_version:1,verification:{all_tables_complete:true,truncated:false},tables:Object.fromEntries(Object.entries(older).map(([k,rows])=>[k,{rows}]))});equal(validate().status,0);const legacyPath=join(work,'older.db');makeDb(legacyPath).close();result=restore(legacyPath);equal(result.status,0,result.stderr);const legacyDb=new DatabaseSync(legacyPath);equal(legacyDb.prepare('SELECT COUNT(*) n FROM payment_refunds').get().n,0);equal(legacyDb.prepare('SELECT total_cents n FROM estimates').get().n,10000);legacyDb.close();
 // Older verified exports without request metadata may retain historic refund ledgers.
 older.payments=structuredClone(backup.tables.payments);
 save({backup_format:'FIRE App live database snapshot',format_version:1,verification:{all_tables_complete:true,truncated:false},tables:Object.fromEntries(Object.entries(older).map(([k,rows])=>[k,{rows}]))});equal(validate().status,0);
 const olderLedgerPath=join(work,'older-ledger.db');makeDb(olderLedgerPath).close();result=restore(olderLedgerPath);equal(result.status,0,result.stderr);const olderLedgerDb=new DatabaseSync(olderLedgerPath);equal(olderLedgerDb.prepare('SELECT SUM(amount_cents) n FROM payments').get().n,8300);olderLedgerDb.close();
 equal(validateRecordIdentities(backup.tables),null);sourceDb.close();target.close();interrupted.close();
 console.log(`PASS ${checks}/${checks}: actual in-app synthetic backup → standalone validator → local restore → re-export verification; partial/tip/failed/pending refunds, ownership/reservation/ledger corruption, duplicate input/target records, pre-write failures, interrupted-prefix retry, older verified backups. No network, Stripe, or remote writes.`);
}finally{globalThis.fetch=originalFetch;delete globalThis.__recordsRecoveryDb;rmSync(work,{recursive:true,force:true});}
