/** Focused offline regression for owner-only STAGING migration journal evidence. */
import assert from 'node:assert/strict';
import {
 evaluateMigrationJournal, validateD1Identity, REVIEWED_MIGRATIONS,
 captureStagingJournal, STAGING_DB, STAGING_UUID, SELECT_ONLY
} from './owner_staging_journal_existing_session_readonly.mjs';

const identity={success:true,errors:[],result:{name:STAGING_DB,uuid:STAGING_UUID}};
const rows=REVIEWED_MIGRATIONS.slice(0,22).map((name,i)=>({id:i+1,name}));
const journal={success:true,errors:[],result:[{
 success:true,results:rows,meta:{changes:0,rows_written:0,changed_db:false}
}]};
assert.equal(validateD1Identity(identity),true);
assert.equal(evaluateMigrationJournal(journal).journalCount,22);
assert.equal(evaluateMigrationJournal(journal).pendingMigrationNames.length,3);
assert.equal(evaluateMigrationJournal(journal).pendingMigrationNames[0],
 '0022_stripe_provider_uniqueness.sql');
const full={...journal,result:[{...journal.result[0],
 results:REVIEWED_MIGRATIONS.map((name,i)=>({id:i+1,name}))}]};
assert.equal(evaluateMigrationJournal(full).journalCount,25);
assert.equal(evaluateMigrationJournal(full).pendingMigrationNames.length,0);
for(const alter of [
 x=>x.result[0].results[8].name='unreviewed.sql',
 x=>x.result[0].results[3].id=1,
 x=>x.result[0].results.pop(),
 x=>x.result[0].meta.rows_written=1,
 x=>x.result[0].meta.changed_db=true,
 x=>x.success=false,
 x=>x.result[0].success=false,
 x=>x.errors.push({message:'provider error'})
]){
 const clone=structuredClone(journal);
 alter(clone);
 assert.throws(()=>evaluateMigrationJournal(clone));
}
assert.throws(()=>validateD1Identity({...identity,result:{name:'other',uuid:STAGING_UUID}}));
assert.throws(()=>validateD1Identity({...identity,result:{name:STAGING_DB,uuid:'wrong'}}));
const seen=[];
const result=await captureStagingJournal({
 token:'x'.repeat(24),
 request:async (url,options)=>{
  seen.push([url,options]);
  return {ok:true,text:async()=>JSON.stringify(options.method==='POST'?journal:identity)};
 }
});
assert.equal(result.physicalDatabaseIdentityBeforeAfterVerified,true);
assert.equal(seen.length,3);
assert.deepEqual(seen.map(x=>x[1].method),['GET','POST','GET']);
assert.equal(JSON.parse(seen[1][1].body).sql,SELECT_ONLY);
assert.equal(seen.every(x=>x[0].includes(STAGING_UUID)),true);
assert.equal(seen.every(x=>x[1].redirect==='error'),true);
assert.equal(result.providerWrites,false);
assert.equal(result.gate5Accepted,false);
console.log('PASS: FIRE STAGING pinned 22/25 or 25/25 journal; guards, dual identity and GET/SELECT-only sequence.');
