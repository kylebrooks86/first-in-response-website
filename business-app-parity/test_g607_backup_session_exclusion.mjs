import assert from 'node:assert/strict';
import {
 validateSupplementalRecoveryArchive
} from './shared/lib/complete-supplemental-recovery-validation.mjs';

const make=()=>({
 format:'fire-isolated-supplemental-records',
 version:1,
 allTablesComplete:true,
 truncated:false,
 tables:{
  auth_rate_limits:[],
  d1_migrations:[{id:1,name:'synthetic.sql'}],
  owner_auth_sessions:[]
 },
 rowCounts:{
  auth_rate_limits:0,
  d1_migrations:1,
  owner_auth_sessions:0
 },
 sqliteSequence:{}
});

const validate=x=>validateSupplementalRecoveryArchive(
 x,Object.keys(x.tables));

let checks=0;

assert.equal(validate(make()).rows,1);
checks++;

for(const revoked_at of [null,1900000000]){
 const archive=make();
 archive.tables.owner_auth_sessions.push({
  session_id:'synthetic-session',
  scope:'fire_admin_session',
  expires_at:2000000000,
  revoked_at
 });
 archive.rowCounts.owner_auth_sessions=1;

 assert.throws(()=>validate(archive),/authentication sessions/);
 checks++;
}

const falseCount=make();
falseCount.rowCounts.owner_auth_sessions=1;
assert.throws(()=>validate(falseCount));
checks++;

const sequence=make();
sequence.sqliteSequence.owner_auth_sessions=1;
assert.throws(()=>validate(sequence));
checks++;

const historical=make();
delete historical.tables.owner_auth_sessions;
delete historical.rowCounts.owner_auth_sessions;
assert.equal(validate(historical).rows,1);
checks++;

const records=make();
records.tables.estimate_service_locations=[
 {id:'synthetic-location',estimate_id:'synthetic-estimate'}
];
records.rowCounts.estimate_service_locations=1;

assert.equal(validate(records).rows,2);
checks++;

console.log('G607 BACKUP SESSION EXCLUSION PASS: '+checks+'/'+checks);