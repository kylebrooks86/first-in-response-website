import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {inspectCandidatePreflight} from './audit-local-schema.mjs';
const root=resolve(process.argv[2]||'.');
const files=readdirSync(join(root,'drizzle')).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
const temp=mkdtempSync(join(tmpdir(),'fire-preflight-'));let checks=0;
function equal(actual,expected){assert.equal(actual,expected);checks++;}
function ok(value){assert.ok(value);checks++;}
const filename=join(temp,'fixture.sqlite'),db=new DatabaseSync(filename);
try {
 for(const file of files)db.exec(readFileSync(join(root,'drizzle',file),'utf8'));
 let report=inspectCandidatePreflight(db,root);
 equal(report.authSchemaCompatible,true);equal(report.candidatePreflightClear,false);equal(report.journalCompatible,false);equal(report.productionReady,false);equal(report.remoteVerified,false);
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL);');
 for(const name of files)db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);
 report=inspectCandidatePreflight(db,root);equal(report.candidatePreflightClear,true);equal(report.ledgerChecks.every(check=>check.anomalyCount===0),true);
 db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(files[0]);equal(inspectCandidatePreflight(db,root).candidatePreflightClear,false);db.exec('DELETE FROM d1_migrations WHERE id=(SELECT MAX(id) FROM d1_migrations)');
 db.exec('DROP TABLE auth_rate_limits; CREATE TABLE auth_rate_limits(key TEXT NOT NULL,attempts INTEGER NOT NULL,window_started_at INTEGER NOT NULL,blocked_until INTEGER NOT NULL);');
 report=inspectCandidatePreflight(db,root);equal(report.authSchemaCompatible,false);ok(report.invalidAuthColumns.includes('key'));
 db.exec('DROP TABLE auth_rate_limits; CREATE TABLE auth_rate_limits(key TEXT NOT NULL,attempts INTEGER NOT NULL,window_started_at INTEGER NOT NULL,blocked_until INTEGER NOT NULL, PRIMARY KEY(key,attempts));');equal(inspectCandidatePreflight(db,root).authSchemaCompatible,false);
 db.exec('DROP TABLE auth_rate_limits; CREATE TABLE auth_rate_limits(key TEXT PRIMARY KEY NOT NULL,attempts TEXT NOT NULL,window_started_at INTEGER,blocked_until INTEGER NOT NULL);');
 report=inspectCandidatePreflight(db,root);ok(report.invalidAuthColumns.includes('attempts'));ok(report.invalidAuthColumns.includes('window_started_at'));
 db.exec('DROP TABLE auth_rate_limits;');equal(inspectCandidatePreflight(db,root).authSchemaCompatible,false);db.exec(readFileSync(join(root,'drizzle/0009_spicy_micromax.sql'),'utf8'));
 db.exec('DROP INDEX idx_payments_stripe_provider_unique;');
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('synthetic-customer','Synthetic QA','now'); INSERT INTO estimates(id,customer_id,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('synthetic-estimate','synthetic-customer',100,100,50,'now')");
 function payment(id,provider){db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,'synthetic-estimate','balance',100,'paid',?,'now')").run(id,provider);}
 payment('synthetic-a','cs_synthetic-collision');payment('synthetic-b','cs_synthetic-collision');
 report=inspectCandidatePreflight(db,root);equal(report.ledgerChecks[0].anomalyCount,1);equal(report.candidatePreflightClear,false);
 db.exec("DELETE FROM payments WHERE id='synthetic-b'");equal(inspectCandidatePreflight(db,root).ledgerChecks[0].anomalyCount,0);
 db.exec("CREATE UNIQUE INDEX idx_payments_stripe_provider_unique ON payments(provider_id) WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*';");equal(inspectCandidatePreflight(db,root).candidatePreflightClear,true);
 db.exec("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES('synthetic-refund','synthetic-a','synthetic-estimate',200,'original','pending','now')");
 equal(inspectCandidatePreflight(db,root).ledgerChecks[1].anomalyCount,1);
 db.exec("UPDATE payment_refunds SET amount_cents=50,status='succeeded' WHERE id='synthetic-refund'");
 report=inspectCandidatePreflight(db,root);equal(report.ledgerChecks[1].anomalyCount,0);equal(report.ledgerChecks[2].anomalyCount,1);equal(report.candidatePreflightClear,false);
 db.exec("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES('synthetic-refund-ledger','synthetic-estimate','Refund',-50,'paid','refund:synthetic-a:synthetic-refund','now')");equal(inspectCandidatePreflight(db,root).ledgerChecks[2].anomalyCount,0);equal(inspectCandidatePreflight(db,root).candidatePreflightClear,true);
 const cleanBefore=readFileSync(filename);const cleanRun=spawnSync(process.execPath,[join(root,'scripts/audit-local-schema.mjs'),filename,root],{encoding:'utf8'});
 equal(cleanRun.status,0);equal(JSON.parse(cleanRun.stdout).productionReady,false);assert.deepEqual(readFileSync(filename),cleanBefore);checks++;
 db.exec('DROP TABLE payment_refunds;');report=inspectCandidatePreflight(db,root);equal(report.ledgerChecks[1].status,'unavailable');equal(report.candidatePreflightClear,false);
 db.close();const before=readFileSync(filename);
 const run=spawnSync(process.execPath,[join(root,'scripts/audit-local-schema.mjs'),filename,root],{encoding:'utf8'});
 equal(run.status,1);equal(JSON.parse(run.stdout).remoteVerified,false);assert.deepEqual(readFileSync(filename),before);checks++;
 console.log(`PASS ${checks}/${checks}: auth table types/nullability/key, journal uncertainty/duplicates, provider collision counts, missing ledger tables and byte-for-byte read-only CLI; ${files.length} disposable target migrations.`);
} finally {try{db.close();}catch{}rmSync(temp,{recursive:true,force:true});}
