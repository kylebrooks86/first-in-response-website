/** Disposable native workerd/D1 migration-plan tests. No remote bindings or credentials. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {loadPropertyUpgrade,capturePropertyUpgradeMetadata,evaluatePropertyUpgrade} from './property-upgrade-preflight.mjs';
const require=createRequire(import.meta.url);
const {Miniflare}=require(process.env.FIRE_PREFLIGHT_MINIFLARE_MODULE||'miniflare');
const repo=resolve(process.argv[2]??'../..'),manifest=join(repo,'business-app-parity/release/property-upgrade/manifest.json');let passed=0;const checks=[];
const split=sql=>{
 const p=spawnSync('python3',['-c',"import sys,sqlite3,json\ns=sys.stdin.read();b='';out=[]\nfor c in s:\n b+=c\n if c==';' and sqlite3.complete_statement(b):out.append(b);b=''\nif b.strip() and not all(x.strip().startswith('--') for x in b.splitlines() if x.strip()):raise ValueError('Incomplete SQL')\nprint(json.dumps(out))"],{input:sql,encoding:'utf8'});
 if(p.status!==0)throw Error(p.stderr);return JSON.parse(p.stdout);
};
const check=(name,fn)=>{fn();passed++;checks.push(name);};
for(const target of ['live','doomsday','staging']){
 const root=join(repo,'business-app-parity/adapters',target),pkg=loadPropertyUpgrade(root,manifest,target);
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'synthetic-schema-'+target},d1Persist:false});
 try{
  const db=await mf.getD1Database('DB');
  const all=async sql=>(await db.prepare(sql).all()).results,get=sql=>db.prepare(sql).first();
  const statements=[];for(const file of pkg.plan.baseline)statements.push(...split(readFileSync(join(root,'drizzle',file.name),'utf8')));
  await db.batch(statements.map(s=>db.prepare(s)));
  await db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)').run();
  await db.batch(pkg.baselineNames.map(n=>db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(n)));
  const report=async()=>evaluatePropertyUpgrade(await capturePropertyUpgradeMetadata({all,get},root),pkg);
  let r=await report();
  check(target+' native baseline exact schema and journal',()=>assert.equal(r.eligibleForSeparatelyApprovedUpgrade,true,JSON.stringify(r)));
  // Native batch must roll back BOTH schema changes and journal inserts after a deliberate failure.
  const pending=pkg.planned.flatMap(file=>[...split(file.sql).map(s=>db.prepare(s)),db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(file.name)]);
  await assert.rejects(db.batch([...pending,db.prepare('INSERT INTO table_that_does_not_exist VALUES(1)')]));
  r=await report();check(target+' failed batch rolls back DDL and journal atomically',()=>assert.equal(r.eligibleForSeparatelyApprovedUpgrade,true,JSON.stringify(r)));
  await db.batch(pending);r=await report();
  check(target+' native complete exact schema and journal',()=>assert.equal(r.candidatePropertySchemaReady,true,JSON.stringify(r)));
  check(target+' native empty-schema legacy rollback compatible',()=>assert.equal(r.legacyAppRollbackCompatible,true));
  await db.prepare("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic','2026-10-14')").run();
  await db.prepare("INSERT INTO customer_properties(id,customer_id,address,created_at) VALUES('p','c','123 Synthetic','2026-10-14')").run();
  r=await report();check(target+' native retained records block legacy rollback',()=>assert.equal(r.candidatePropertySchemaReady&&!r.legacyAppRollbackCompatible,true));
  await assert.rejects(db.prepare("DELETE FROM customer_properties WHERE id='p'").run());
  check(target+' native immutable history retained',()=>assert.ok(true));
  await db.prepare('DROP TRIGGER customer_property_no_delete').run();
  await db.prepare('CREATE TRIGGER customer_property_no_delete BEFORE DELETE ON customer_properties BEGIN SELECT 1; END').run();r=await report();
  check(target+' native same-name weakened trigger rejected',()=>assert.equal(r.candidatePropertySchemaReady,false));
  check(target+' native checks never confer deployment authority',()=>assert.equal(r.remoteVerified||r.productionReady||r.executionAuthorized,false));
 }finally{await mf.dispose();}
}
console.log(JSON.stringify({passed,total:checks.length,checks,scope:'Disposable native local D1 only; no hosted identity or release approval'},null,2));
