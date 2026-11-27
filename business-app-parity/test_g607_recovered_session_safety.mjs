import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {assertRecoveredSessionsEmpty} from './shared/lib/recovered-session-safety.mjs';

const db = new DatabaseSync(':memory:');
let checks = 0;

try {
  assert.throws(()=>assertRecoveredSessionsEmpty(db));
  checks++;

  db.exec(readFileSync(new URL(
    './release/G607_OWNER_SESSION_SCHEMA_PROPOSED.sql',
    import.meta.url
  ),'utf8'));

  assert.equal(assertRecoveredSessionsEmpty(db),true);
  checks++;

  db.prepare(
    'INSERT INTO owner_auth_sessions VALUES (?,?,?,?)'
  ).run('synthetic-active','fire_admin_session',2000000000,null);

  assert.throws(()=>assertRecoveredSessionsEmpty(db));
  checks++;

  db.exec('DELETE FROM owner_auth_sessions');

  db.prepare(
    'INSERT INTO owner_auth_sessions VALUES (?,?,?,?)'
  ).run('synthetic-revoked','fire_admin_session',2000000000,1900000000);

  assert.throws(()=>assertRecoveredSessionsEmpty(db));
  checks++;

  db.exec('DELETE FROM owner_auth_sessions');

  assert.equal(assertRecoveredSessionsEmpty(db),true);
  checks++;

  assert.throws(()=>assertRecoveredSessionsEmpty(null));
  checks++;

  console.log('G607 RECOVERY SESSION SAFETY PASS: '+checks+'/'+checks);
} finally {
  db.close();
}