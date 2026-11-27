const normalize=sql=>String(sql??'')
 .replace(/\s+/g,'').replace(/;$/,'').toLowerCase();

const expectedTable=`
CREATE TABLE owner_auth_sessions (
 session_id TEXT NOT NULL,
 scope TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 PRIMARY KEY (session_id, scope)
)`;

const expectedIndex=`
CREATE INDEX owner_auth_sessions_expiry
ON owner_auth_sessions (expires_at)`;

export function assertSessionSchemaDefinitions(table,index){
 if(normalize(table)!==normalize(expectedTable) ||
    normalize(index)!==normalize(expectedIndex))
  throw Error('Authentication session schema differs from reviewed migration');
 return true;
}

export function assertRecoveredSessionsEmpty(db){
 if(!db||typeof db.prepare!=='function')
  throw Error('Recovery session storage unavailable');

 const table=db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='owner_auth_sessions'"
 ).get();

 const index=db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='index' AND name='owner_auth_sessions_expiry' AND tbl_name='owner_auth_sessions'"
 ).get();

 assertSessionSchemaDefinitions(table?.sql,index?.sql);

 const row=db.prepare(
  'SELECT COUNT(*) AS n FROM owner_auth_sessions'
 ).get();

 if(!row||row.n!==0)
  throw Error('Recovery blocked: authentication sessions must not be restored');

 return true;
}