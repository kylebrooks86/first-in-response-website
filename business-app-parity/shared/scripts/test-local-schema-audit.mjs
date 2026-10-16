import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {inspectSchema} from './audit-local-schema.mjs';
const root=resolve(process.argv[2]||'.');
const files=readdirSync(join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort();
const temporary=mkdtempSync(join(tmpdir(),'fire-schema-audit-'));
try {
 const filename=join(temporary,'fixture.sqlite'),db=new DatabaseSync(filename);
 for(const file of files)db.exec(readFileSync(join(root,'drizzle',file),'utf8'));
 let report=inspectSchema(db,root);
 assert.equal(report.schemaCompatible,true);assert.equal(report.journal.status,'unavailable');assert.equal(report.productionReady,false);
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT);');
 for(const file of files)db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(file);
 report=inspectSchema(db,root);assert.deepEqual(report.journal.missing,[]);assert.equal(report.journal.recordedFileCount,files.length);assert.equal(report.journal.appliedOrderMatchesCandidate,true);
 // A set-complete journal can still be unsafe if two applied IDs are swapped.
 db.prepare('UPDATE d1_migrations SET name=CASE WHEN id=1 THEN ? WHEN id=2 THEN ? ELSE name END WHERE id IN (1,2)').run(files[1],files[0]);
 report=inspectSchema(db,root);
 assert.equal(report.journal.appliedOrderMatchesCandidate,false);
 assert.deepEqual(report.journal.missing,[]);
 assert.deepEqual(report.journal.unexpected,[]);
 db.prepare('UPDATE d1_migrations SET name=CASE WHEN id=1 THEN ? WHEN id=2 THEN ? ELSE name END WHERE id IN (1,2)').run(files[0],files[1]);
 assert.equal(inspectSchema(db,root).journal.appliedOrderMatchesCandidate,true);
 db.prepare('DELETE FROM d1_migrations WHERE name=?').run(files.at(-1));
 report=inspectSchema(db,root);assert.equal(report.schemaCompatible,true);assert.deepEqual(report.journal.missing,[files.at(-1)]);
 // A journal without an explicit applied-sequence ID cannot prove order.
 db.exec('DROP TABLE d1_migrations; CREATE TABLE d1_migrations(name TEXT NOT NULL);');
 for(const file of files)db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(file);
 report=inspectSchema(db,root);
 assert.equal(report.journal.status,'unrecognized-format');
 // Name alone cannot prove a safe index: reject nonunique and wrong predicates.
 db.exec("DROP INDEX idx_payments_stripe_provider_unique; CREATE INDEX idx_payments_stripe_provider_unique ON payments(provider_id) WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*';");
 assert.deepEqual(inspectSchema(db,root).invalidIndexes,['idx_payments_stripe_provider_unique']);
 db.exec("DROP INDEX idx_payments_stripe_provider_unique; CREATE UNIQUE INDEX idx_payments_stripe_provider_unique ON payments(provider_id) WHERE provider_id GLOB 'cs_*';");
 assert.deepEqual(inspectSchema(db,root).invalidIndexes,['idx_payments_stripe_provider_unique']);
 db.exec('DROP TABLE payment_checkout_sessions;');
 assert.ok(inspectSchema(db,root).missingColumns.includes('payment_checkout_sessions.id'));
 db.close();
 const before=readFileSync(filename);
 const run=spawnSync(process.execPath,[join(root,'scripts/audit-local-schema.mjs'),filename,root],{encoding:'utf8'});
 assert.equal(run.status,1);assert.equal(JSON.parse(run.stdout).productionReady,false);assert.deepEqual(readFileSync(filename),before);
 console.log(`PASS: ${files.length} disposable migrations; compatible schema, unknown/incomplete journals, wrong uniqueness/predicate, missing checkout table, and CLI byte-for-byte read-only verification.`);
}finally{rmSync(temporary,{recursive:true,force:true});}
