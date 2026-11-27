/** Disposable recovery safeguard. Never modifies a hosted database. */
export function assertRecoveredSessionsEmpty(db) {
  if (!db || typeof db.prepare !== 'function')
    throw Error('Recovery session storage unavailable');

  const row = db.prepare(
    'SELECT COUNT(*) AS n FROM owner_auth_sessions'
  ).get();

  if (!row || row.n !== 0)
    throw Error('Recovery blocked: authentication sessions must not be restored');

  return true;
}