/** FIRE NEW LIVE ambiguous prior attempt: offline unit tests only. NO Cloudflare. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 validateAttemptLock,validateLockedConfig,verifyPhysicalIdentity,
 classifyRemoteInventory
} from './owner_new_live_attempt_readonly_reconcile.mjs';

const live='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const goodLock={
 target:'independent-live',database_name:'fire-fullapp-new-live-db',
 database_id:live,state:'REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY',
 sourceMigrationCount:26,physicalIdentityConfirmed:true,
 initialApplicationTables:0,createdAt:'2026-11-14T23:30:00.000Z'
};
const goodConfig={d1_databases:[{
 binding:'DB',database_name:'fire-fullapp-new-live-db',
 database_id:live,migrations_dir:'migrations',migrations_table:'d1_migrations'
}]};
let checks=0;
const pass=(value,msg)=>{assert.equal(value,true,msg);checks++};
const reject=(fn,msg)=>{
 assert.throws(fn,/FIRE_NEW_LIVE_ATTEMPT_READ_ONLY_STOP/,msg);
 checks++;
};
pass(validateAttemptLock(goodLock),'original one-shot lock accepted, never removed');
for(const patch of [
 {target:'independent-dr'},
 {database_name:'fire-fullapp-dr-db'},
 {database_id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'},
 {state:'COMPLETE'},
 {sourceMigrationCount:25},
 {physicalIdentityConfirmed:false},
 {initialApplicationTables:1},
 {createdAt:'bogus'}
])reject(()=>validateAttemptLock({...goodLock,...patch}),'wrong lock refused');
for(const malformed of [null,{},[],{...goodLock,createdAt:12}])
 reject(()=>validateAttemptLock(malformed),'malformed lock refused');
pass(validateLockedConfig(goodConfig),'only exact independent NEW LIVE config');
for(const patch of [
 {binding:'WRONG'}, {database_id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'},
 {migrations_table:'other'}, {database_name:'fire-fullapp-dr-db'}
])reject(()=>validateLockedConfig({d1_databases:[{...goodConfig.d1_databases[0],...patch}]}),
 'wrong DB config rejected');
reject(()=>validateLockedConfig({d1_databases:[goodConfig.d1_databases[0],goodConfig.d1_databases[0]]}),
 'cross DB configuration rejected');
pass(verifyPhysicalIdentity({name:'fire-fullapp-new-live-db',uuid:live}),
 'remote physically observed UUID must exactly match');
for(const x of [
 null,{name:'fire-fullapp-dr-db',uuid:live},
 {name:'fire-fullapp-new-live-db',uuid:'wrong'}
])reject(()=>verifyPhysicalIdentity(x),'wrong provider D1 identity refused');

const provider=[{type:'table',name:'_cf_KV'}];
const journal=[{type:'table',name:'d1_migrations'}];
const app=[{type:'table',name:'jobs'},{type:'index',name:'some_index'}];
let o=classifyRemoteInventory(provider,null);
pass(o.state==='NO_JOURNAL_AND_NO_APPLICATION_OBJECTS_SEEN'&&o.journalCount===null,
 'no journal and no app tables is NOT a success receipt');
o=classifyRemoteInventory([...provider,...app],null);
pass(o.state==='APPLICATION_OBJECTS_WITHOUT_JOURNAL_NEEDS_INVESTIGATION',
 'app objects without journal must not be treated as clean');
o=classifyRemoteInventory([...provider,...journal],0);
pass(o.state==='ZERO_JOURNAL_ROWS_NEEDS_INVESTIGATION',
 'empty journal does NOT reauthorize a write');
o=classifyRemoteInventory([...provider,...journal],13);
pass(o.state==='INCOMPLETE_JOURNAL_DO_NOT_RETRY',
 'partially applied journal blocks retry');
o=classifyRemoteInventory([...provider,...journal,...app],26);
pass(o.state==='COMPLETE_JOURNAL_FULL_SOURCE_PROOF_PENDING'&&
 o.fullSchemaVerified===false,'26 rows alone DO NOT prove exact schema or first Job #0001');
o=classifyRemoteInventory([...provider,...journal],27);
pass(o.state==='UNEXPECTED_EXTRA_JOURNAL_ROWS_DO_NOT_RETRY',
 'unrecognized extra migrations block');
for(const [rows,n] of [
 [null,null],[[],0],[journal,null],[journal,-1],
 [journal,1.5],[journal,'26'],
 [[journal[0],journal[0]],26],
 [[{type:'DROP',name:'jobs'}],null]
])reject(()=>classifyRemoteInventory(rows,n),'unsafe or contradictory remote result refused');
const source=readFileSync(fileURLToPath(new URL('./owner_new_live_attempt_readonly_reconcile.mjs',import.meta.url)),'utf8');
for(const required of [
 'NO_JOURNAL_AND_NO_APPLICATION_OBJECTS_SEEN',
 'COMPLETE_JOURNAL_FULL_SOURCE_PROOF_PENDING',
 'inspectNewLiveFirstJobCleanStart',
 'oneShotAttemptLockPreserved:true',
 'migrationRetryAllowed:false',
 'remoteWritePerformed:false'
])pass(source.includes(required),'read-only guard source retained '+required);
pass(!source.includes("['d1','migrations','apply'"),
 'script has no migrations apply invocation');
pass(!source.includes("['d1','create'"),
 'script has no D1 create invocation');
pass(!source.includes("['deploy'"),
 'script has no Worker deploy invocation');
console.log('PASS '+checks+'/'+checks+' NEW LIVE locked-attempt READ-ONLY offline tamper checks. NO CLOUD PROVIDER USED.');
