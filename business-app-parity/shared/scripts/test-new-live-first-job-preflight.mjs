/** Source-only NEW LIVE #0001 clean-D1 pre-activation regression, NO D1 writes. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from '../lib/new-live-migration-journal.mjs';
import {inspectNewLiveFirstJobCleanStart} from '../lib/new-live-first-job-preflight.mjs';
import {REVIEWED_INDEPENDENT_D1_NAMED_INDEXES} from '../lib/new-live-index-view-contract.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from '../lib/numbered-records-v2-preflight.mjs';
const tables=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES,'auth_rate_limits','d1_migrations'];
const applied=EXPECTED_NEW_LIVE_D1_MIGRATIONS.map((name,i)=>({id:i+1,name}));
const provider={name:'_cf_METADATA',sql:'CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB)'};
const triggers=[
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete',
 'deposit_policy_events_no_update','deposit_policy_events_no_delete',
 'deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete'
];
// Real migration SQL is the test oracle; a hard-coded copy of the index
// contract would permit test and implementation to drift together.
const financialNames=[
 'idx_invoices_one_per_estimate',
 'idx_payment_checkout_sessions_one_open_per_estimate',
 'idx_payment_refunds_estimate_status','idx_payment_refunds_payment_status',
 'idx_payment_refunds_provider','idx_payments_stripe_provider_unique',
 'idx_payments_unique_refund_provider'
];
const financialSource=['0015_single_open_checkout.sql','0017_one_invoice_per_estimate.sql',
 '0018_payment_refunds.sql','0019_refund_ledger_unique.sql',
 '0022_stripe_provider_uniqueness.sql'].map(name=>
  readFileSync(new URL('../../adapters/doomsday/drizzle/'+name,import.meta.url),'utf8')).join('\n');
const actualFinancialIndexes=[...financialSource.matchAll(
 /CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"]?(idx_[a-z0-9_]+)[`"]?\s+[\s\S]*?;/gi)]
 .map(match=>({name:match[1],sql:match[0]}))
 .filter(item=>financialNames.includes(item.name))
 .sort((a,b)=>a.name.localeCompare(b.name));
assert.deepEqual(actualFinancialIndexes.map(item=>item.name),[...financialNames].sort(),
 'all required financial indexes must be grounded in the actual 25 release SQL files');
const trustedTriggerSql=new Map([
 ...[...readFileSync(new URL('../../customer-numbering/customer_numbers_v1.sql',import.meta.url),'utf8').matchAll(
  /CREATE TRIGGER\s+([a-z_]+)[\s\S]*?\bEND\s*;/gi)],
 ...[...readFileSync(new URL('../../job-numbering/job_numbers_v1.sql',import.meta.url),'utf8').matchAll(
  /CREATE TRIGGER\s+([a-z_]+)[\s\S]*?\bEND\s*;/gi)],
 ...[...readFileSync(new URL('../../adapters/doomsday/drizzle/0023_deposit_policy_events.sql',import.meta.url),'utf8').matchAll(
  /CREATE TRIGGER\s+([a-z_]+)[\s\S]*?\bEND\s*;/gi)],
 ...[...readFileSync(new URL('../../adapters/doomsday/drizzle/0024_deposit_agreement_snapshots.sql',import.meta.url),'utf8').matchAll(
  /CREATE TRIGGER\s+([a-z_]+)[\s\S]*?\bEND\s*;/gi)]
].map(match=>[match[1],match[0]]));
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const blocked=async(fn,why)=>{await assert.rejects(fn(),/BLOCKED/,why);checks++;};
const create=(override={})=>{
 const v={tables:[...tables],triggers:[...triggers],rows:{d1_migrations:26},
  journalRows:applied.map(row=>({...row})),serialRows:0,
  financialIndexes:actualFinancialIndexes.map(row=>({...row})),
  namedSchemaObjects:reviewedNamedIndexRows.map(row=>({...row})),
  validSchema:true,validCoverage:true,validCustomerSchema:true,validCustomerCoverage:true,...override};
 const statements=[];
 const db={prepare(sql){
  statements.push(sql);
  if(!/^SELECT\b/i.test(sql.trim()))throw Error('Unexpected write SQL!');
  const count=/^SELECT COUNT\(\*\) AS n FROM "([a-z0-9_]+)"$/.exec(sql);
  return {all:async()=>sql.includes("type='view' OR (type='index'")?
   ({results:v.namedSchemaObjects.map(row=>({...row}))}):sql.includes("FROM sqlite_master WHERE type='index'")?
   ({results:v.financialIndexes.map(row=>({...row}))}):sql==='SELECT id, name FROM "d1_migrations" ORDER BY id'?
   ({results:v.journalRows}):sql.includes('SELECT name,sql FROM sqlite_master')?
   ({results:v.triggers.filter(name=>[...sql.matchAll(/'([a-z_]+)'/g)]
    .some(match=>match[1]===name)).map(name=>({name,sql:Object.hasOwn(v.triggerSqlOverride||{},name)?
    v.triggerSqlOverride[name]:trustedTriggerSql.get(name)}))}):
   ({results:v.validCustomerSchema?
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
// Compare the allowlist to the real reviewed migration source, not a
// second independently hard-coded test array that could drift in silence.
const baseSql=readdirSync(new URL('../../adapters/doomsday/drizzle/',import.meta.url))
 .filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
const isolatedSql=readdirSync(new URL('../../adapters/independent-live/drizzle/',import.meta.url))
 .filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
assert.equal(baseSql.length,25,'QA/STAGING source retains its original 25 migrations');
assert.deepEqual(isolatedSql,['0025_independent_permanent_numbers.sql'],
 'Only independent targets append numbered release schema');
assert.deepEqual(EXPECTED_NEW_LIVE_D1_MIGRATIONS,[...baseSql,...isolatedSql],
 'Exact journal requires 25 shared plus 1 independent release migration');
assert.equal(readFileSync(new URL('../../adapters/independent-dr/drizzle/0025_independent_permanent_numbers.sql',import.meta.url),'utf8'),
 readFileSync(new URL('../../adapters/independent-live/drizzle/0025_independent_permanent_numbers.sql',import.meta.url),'utf8'),
 'DR and NEW LIVE numbered migration bytes must match');
checks++;
// The source SQL, NOT the new validator's literal allowlist, is the test oracle.
// Every named index must exist in a reviewed 0000..0025 SQL migration, and
// those reviewed migrations must never create any VIEW.
const reviewedSql=baseSql.map(name=>readFileSync(
 new URL('../../adapters/doomsday/drizzle/'+name,import.meta.url),'utf8')).concat(
 isolatedSql.map(name=>readFileSync(
  new URL('../../adapters/independent-live/drizzle/'+name,import.meta.url),'utf8')));
assert.ok(reviewedSql.every(sql=>!/^\s*CREATE\s+VIEW\b/im.test(sql)),
 'Reviewed independent migrations do not create SQL views');
const migrationIndexNames=reviewedSql.flatMap(sql=>[...sql.matchAll(
 /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-z0-9_]+)/gim)].map(match=>match[1]));
assert.equal(new Set(migrationIndexNames).size,migrationIndexNames.length,
 'Reviewed migrations may not define duplicate named indexes');
assert.deepEqual([...migrationIndexNames].sort(),
 [...REVIEWED_INDEPENDENT_D1_NAMED_INDEXES].sort(),
 'Named-index activation allowlist must match all 26 actual reviewed SQL files');
const reviewedNamedIndexRows=migrationIndexNames.map(name=>({type:'index',name}));
checks++;
const base=create();const proof=await inspectNewLiveFirstJobCleanStart(base.db,env);
ok(proof.firstJobNumberExpected==='0001','clean schema predicts first permanent Job #0001');
ok(proof.tableRecordsAllEmpty===true&&proof.jobAndCustomerSequencesEmpty===true,
 'all known operational tables and sequences inspected');
ok(proof.physicalFinancialIndexesMatched===true,
 'bound D1 refund, provider uniqueness and invoice indexes must match actual reviewed SQL');
ok(proof.reviewedNamedIndexesAndNoViewsVerified===true,
 'all 26 reviewed SQL named indexes exist and no unapproved VIEW is installed');
ok(proof.exactSourceMigrationJournalMatched===true,
 'actual NEW LIVE source check now requires all 26 ordered D1 migrations');
ok(proof.requiredImmutabilityTriggersPresent===true,
 'source check also enforces actual immutable trigger SQL');
ok(proof.immutableDepositHistoryTriggersVerified===true,
 'source check also enforces signed deposit agreements and append-only exception audit');
ok(proof.physicalD1IdentityVerified===false&&proof.orderedMigrationsVerified===false,
 'no false provider identity or migration execution proof');
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
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{d1_migrations:25}}).db,env),
 'older migration journal cannot claim NEW LIVE readiness');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({rows:{d1_migrations:27}}).db,env),
 'unreviewed new migration blocks first-use');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.slice(0,-1)}).db,env),
 'forged count with missing migration row blocks first-use');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.map((row,i)=>
 i===18?{...row,name:'0018_manual_processing_fees.sql'}:row)}).db,env),
 'forged refund migration filename cannot pass');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.map((row,i)=>
 i===5?{...row,id:5}:row)}).db,env),
 'duplicate migration journal IDs block');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:[...applied].reverse()}).db,env),
 'migrations must be in strict order');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:null}).db,env),
 'malformed migration journal response blocks');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({journalRows:applied.map((row,i)=>
 i===17?{...row,name:'0017_renamed.sql'}:row),
 triggerSqlOverride:{fire_job_numbers_no_update:
 'CREATE TRIGGER fire_job_numbers_no_update BEFORE UPDATE ON fire_job_numbers BEGIN SELECT 1; END;'}}).db,env),
 'forged migration AND no-op trigger cannot jointly pass');
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
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggers:triggers.filter(name=>name!=='deposit_agreement_snapshots_no_delete')}).db,env),
 'missing signed agreement delete barrier prevents first use');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 namedSchemaObjects:[...reviewedNamedIndexRows,{type:'index',name:'unexpected_unique_customer_index'}]
}).db,env),'unexpected UNIQUE index can block real owner saves; refuse first LIVE activation');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 namedSchemaObjects:[...reviewedNamedIndexRows,{type:'view',name:'unreviewed_customer_view'}]
}).db,env),'unknown SQL view is not part of the reviewed 26-migration schema');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 namedSchemaObjects:reviewedNamedIndexRows.slice(1)
}).db,env),'missing nonfinancial customer/job index cannot pass reviewed schema inventory');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 namedSchemaObjects:reviewedNamedIndexRows.map((row,i)=>i===0?{...row,name:'forged_index'}:row)
}).db,env),'renaming a reviewed index to a foreign name stops activation');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggers:[...triggers,'unknown_payment_trigger']}).db,env),
 'unknown trigger may alter business rows and must not pass reviewed clean-start');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggerSqlOverride:{
 deposit_policy_events_no_update:'CREATE TRIGGER deposit_policy_events_no_update BEFORE UPDATE ON deposit_policy_events BEGIN SELECT 1; END;'
 }}).db,env),'named but no-op deposit audit barrier cannot establish immutable exception history');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggerSqlOverride:{
 deposit_agreement_snapshots_no_delete:"CREATE TRIGGER deposit_agreement_snapshots_no_delete AFTER DELETE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'Signed deposit agreement is immutable'); END;"
 }}).db,env),'signed agreement delete barrier must run BEFORE DELETE');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggerSqlOverride:{
 fire_job_numbers_no_update:'CREATE TRIGGER fire_job_numbers_no_update BEFORE UPDATE ON fire_job_numbers BEGIN SELECT 1; END;'
 }}).db,env),'named but ineffective Job # immutability trigger stops first-use');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({triggerSqlOverride:{
 fire_customer_numbers_no_delete:'CREATE TRIGGER fire_customer_numbers_no_delete AFTER DELETE ON fire_customer_numbers BEGIN SELECT RAISE(ABORT,\'FIRE customer numbers cannot be reused\'); END;'
 }}).db,env),'named but AFTER customer delete trigger cannot prove immutability');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 financialIndexes:actualFinancialIndexes.filter(row=>row.name!=='idx_payment_refunds_provider')
}).db,env),'forged 26-row journal without refund uniqueness index blocks');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 financialIndexes:actualFinancialIndexes.map(row=>row.name==='idx_payments_unique_refund_provider'?
  {...row,sql:row.sql.replace('CREATE UNIQUE INDEX','CREATE INDEX')}:row)
}).db,env),'named but NONUNIQUE refund-ledger index blocks');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 financialIndexes:actualFinancialIndexes.map(row=>row.name==='idx_payments_stripe_provider_unique'?
  {...row,sql:row.sql.replace(/WHERE[\s\S]*;/,';')}:row)
}).db,env),'Stripe provider index lacking correct partial scope blocks');
await blocked(()=>inspectNewLiveFirstJobCleanStart(create({
 financialIndexes:[...actualFinancialIndexes,actualFinancialIndexes[0]]
}).db,env),'duplicate financial index metadata blocks');
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
