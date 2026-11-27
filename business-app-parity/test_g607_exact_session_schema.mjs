import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {assertRecoveredSessionsEmpty} from './shared/lib/recovered-session-safety.mjs';

const sql=readFileSync(new URL(
 './release/G607_OWNER_SESSION_SCHEMA_PROPOSED.sql',
 import.meta.url
),'utf8');

let checks=0;

for(const [label,ddl,valid] of [
 ['Exact session schema',sql,true],
 ['Missing primary key',sql.replace(',\n    PRIMARY KEY (session_id, scope)',''),false],
 ['Nullable session identifier',sql.replace('session_id TEXT NOT NULL','session_id TEXT'),false],
 ['Nullable environment scope',sql.replace('scope TEXT NOT NULL','scope TEXT'),false],
 ['Wrong expiry type',sql.replace('expires_at INTEGER','expires_at TEXT'),false],
 ['Wrong revocation type',sql.replace('revoked_at INTEGER','revoked_at TEXT'),false],
 ['Wrong expiry index',sql.replace('(expires_at);','(scope);'),false],
 ['Missing expiry index',sql.split('CREATE INDEX')[0],false]
]){
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(ddl);
  if(valid)assert.equal(assertRecoveredSessionsEmpty(db),true);
  else assert.throws(()=>assertRecoveredSessionsEmpty(db));
  checks++;
  console.log('PASS:',label);
 }finally{db.close();}
}

console.log('G607 EXACT SESSION SCHEMA PASS: '+checks+'/'+checks);