/** Source-only NEW LIVE #0001 clean-D1 pre-activation regression, NO D1 writes. */
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from '../lib/new-live-migration-journal.mjs';
import {inspectNewLiveFirstJobCleanStart} from '../lib/new-live-first-job-preflight.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from '../lib/numbered-records-v2-preflight.mjs';
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES,'auth_rate_limits','d1_migrations'];
const applied=EXPECTED_NEW_LIVE_D1_MIGRATIONS.map((name,i)=>({id:i+1,name}));
const provider={name:'_cf_METADATA',sql:'CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB)'};
const triggers=[
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete'
];
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const blocked=async(fn,why)=>{await assert.rejects(fn(),/BLOCKED/,why);checks++;};
const create=(override={})=>{
 const v={tables:[...tables],triggers:[...triggers],rows:{d1_migrations:25},
  journalRows:applied.map(item=>({...item})),serialRows:0,
  validSchema:true,validCoverage:true,validCustomerSchema:true,validCustomerCoverage:true,...override};
 const statements=[];
 const db={prepare(sql){
  statements.push(sql);
  if(!/^SELECT\b/i.test(sql.trim()))throw Error('Unexpected write SQL!');
  const count=/^SELECT COUNT\(\*\) AS n FROM "([a-z0-9_]+)"$/.exec(sql);
  return {all:async()=>sql==='SELECT id, name FROM "d1_migrations" ORDER BY id'?
   ({results:v.journalRows}):({results:v.validCustomerSchema?
   ['fire_customer_numbers','fire_customer_numbers_no_update','fire_customer_numbers_no_delete'].map(name=>({name})):
   [{name:'fire_customer_numbers'}]}),first:async()=>{
   if(sql.includes('AS tables')&&sql.includes('AS triggers'))return {
    tables:v.validSchema?2:1,triggers:v.validSchema?4:3};
   if(sql.includes('AS invalid'))return {invalid:v.validCoverage?0:1};
   if(sql.includes('AS missing'))return {missing:v.validCustomerCoverage?0:1};
   if(sql.includes('AS entries')&&sql.includes("type='table'"))
    return {entries:v.tables.map(item=>typeof item==='string'?
     item+String.fromCharCode(31)+'CREATE TABLE '+item+' (id TEXT)':
     item.name+String.fromCharCode(31)+item.sql).join(String.fromCharCode(30))};
   if(sql.includes("GROUP_CONCAT(name, ',') AS names")&&sql.includes("type='trigger'"))
    return {names:v.triggers.join(',')};
   if(count)return {n:Object.hasOwn(v.rows,count[1])?v.rows[count[1]]:0};
   if(sql.includes('FROM sqlite_sequence'))return {n:v.serialRows};
   throw Error('Unexpected synthetic SELECT');
  }};
 }};
 return {db,statements};
};
const env={FIRE_ENV:'new-live-prelaunch',FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
 FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'};
const actualSql=readdirSync(new URL('../../adapters/doomsday/drizzle/',import.meta.url))
 .filter(name=>name.length>8&&name.slice(0,4).split('').every(ch=>ch>='0'&&ch<='9')&&
  name[4]==='_'&&name.endsWith('.sql')).sort();
assert.deepEqual(EXPECTED_NEW_LIVE_D1_MIGRATIONS,actualSql,
 'The exact applied journal allowlist MUST match all 25 reviewed adapter migrations');
checks++;
const base=create();const proof=await inspectNewLiveFirstJobCleanStart(base.db,env);
ok(proof.firstJobNumberExpected==='0001','clean schema predicts first permanent Job #0001');
ok(proof.tableRecordsAllEmpty===true&&proof.jobAndCustomerSequencesEmpty===true,
 'all known operational tables and sequences inspected');
ok(proof.exactSourceMigrationJournalMatched===true,
 'bound D1 has exact reviewed 25 ordered migration names and IDs');
ok(proof.physicalD1IdentityVerified===false&&proof.orderedMigrationsVerified===false,
 'source journal match never claims independent provider identity/provenance');
ok(proof.ownerApprovedRelease===false&&proof.gate5Accepted===false,'no false gate approval');
ok(base.statements.every(sql=>/^SELECT\b/.test(sql)),'only read-only SELECT operations');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create().db,{...env,FIRE_ENV:'synthetic-qa'}),
 'cannot inspect QA as new LIVE');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create().db,{...env,FIRE_JOB_NUMBERS_CANDIDATE:undefined}),
 'numbering flag cannot be omitted');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create().db,{...env,FIRE_CUSTOMER_NUMBERS_CANDIDATE:undefined}),
 'permanent customer numbering cannot be omitted');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({validCustomerSchema:false}).db,env),
 'missing immutable customer number triggers block new LIVE');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({validCustomerCoverage:false}).db,env),
 'incomplete customer numbering coverage blocks new LIVE');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({validSchema:false}).db,env),
 'missing numbered schema/trigger stops');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({validCoverage:false}).db,env),
 'bad original estimate/job ownership stops');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{d1_migrations:0}}).db,env),
 'empty D1 migration journal cannot establish a real migrated database');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{d1_migrations:24}}).db,env),
 'old 24-migration D1 cannot claim new LIVE readiness');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{d1_migrations:26}}).db,env),
 'unreviewed extra migration must block first use');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.slice(0,-1)}).db,env),
 'count-only spoof with missing journal entry must block');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.map((row,i)=>
 i===18?{...row,name:'0018_manual_processing_fees.sql'}:row)}).db,env),
 'payment/refund migration identity cannot be substituted');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.map((row,i)=>
 i===5?{...row,id:5}:row)}).db,env),
 'duplicated journal ID cannot be accepted');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:[...applied].reverse()}).db,env),
 'applied migrations must be returned in strict ascending ID order');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:null}).db,env),
 'malformed journal response fails closed');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({tables:tables.filter(x=>x!=='d1_migrations')}).db,env),
 'NEW LIVE migration journal cannot be absent');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({tables:tables.filter(x=>x!=='payment_refunds')}).db,env),
 'missing refund journal schema table stops');
const withProvider=create({tables:[...tables,provider]});
ok((await inspectNewLiveFirstJobCleanStart(withProvider.db,env)).firstJobNumberExpected==='0001',
 'documented D1 metadata does not falsely block a clean first job');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({tables:[...tables,
 {name:'_cf_METADATA',sql:'CREATE TABLE _cf_METADATA (key TEXT, value BLOB)'}]}).db,env),
 'spoofed provider metadata cannot hide business records');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({tables:[...tables,'sqliteX_customer_data']}).db,env),
 'sqliteX user tables must not disappear through SQL LIKE underscore wildcard');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({tables:[...tables,'unreviewed_feature']}).db,env),
 'unexpected business table requires separate migration review');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggers:triggers.slice(1)}).db,env),
 'missing immutable customer-number trigger stops');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{customers:1}}).db,env),
 'synthetic customer in proposed new LIVE must never be deleted silently');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{payments:1}}).db,env),
 'existing payment records prevent first-use clean start');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{fire_job_numbers:1}}).db,env),
 'old job number prevents first job #0001');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{customer_photos:1}}).db,env),
 'old photo metadata not silently ignored');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({serialRows:1}).db,env),
 'deleted jobs still consume permanent high-water');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{tasks:'garbage'}}).db,env),
 'invalid D1 counts cannot be treated as empty');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{customers:'  '}}).db,env),
 'whitespace D1 count cannot coerce to zero');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{customers:'0x0'}}).db,env),
 'non-decimal D1 count cannot masquerade as empty');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{customers:[]}}).db,env),
 'array D1 count cannot masquerade as empty');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{payments:null}}).db,env),
 'missing count cannot be converted to zero');
const unavailable=create();unavailable.db.prepare=()=>{throw Error('D1 offline')};
await blocked(()=>inspectNewLiveFirstJobCleanStart(unavailable.db,env),
 'unreadable target fails closed');
console.log('PASS '+checks+'/'+checks+
 ' NEW LIVE first Job #0001 target-bound read-only pre-activation controls; NO D1 writes or remote calls.');
