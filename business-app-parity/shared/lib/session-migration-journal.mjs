import {
  EXPECTED_NEW_LIVE_D1_MIGRATIONS
} from './new-live-migration-journal.mjs';

export function expectedSessionMigrationJournal(target) {
  if (target === 'qa' || target === 'independent-staging') {
    return Object.freeze([
      ...EXPECTED_NEW_LIVE_D1_MIGRATIONS.slice(0,25),
      '0025_owner_auth_sessions.sql'
    ]);
  }

  if (target === 'independent-dr' || target === 'independent-live') {
    return Object.freeze([
      ...EXPECTED_NEW_LIVE_D1_MIGRATIONS,
      '0026_owner_auth_sessions.sql'
    ]);
  }

  throw Error('Unknown session migration target');
}

export async function assertSessionMigrationJournal(db,target) {
  const expected = expectedSessionMigrationJournal(target);

  if (!db || typeof db.prepare !== 'function')
    throw Error('Session migration journal unavailable');

  const response = await db.prepare(
    'SELECT id, name FROM "d1_migrations" ORDER BY id'
  ).all();

  const rows = response?.results;

  if (!Array.isArray(rows) || rows.length !== expected.length)
    throw Error('Unexpected session migration journal length');

  for (let i=0; i<expected.length; i++) {
    if (rows[i]?.id !== i+1 || rows[i]?.name !== expected[i])
      throw Error('Session migration journal identity mismatch');
  }

  return true;
}