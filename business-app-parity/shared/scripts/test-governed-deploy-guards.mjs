// Gate 10 negative-control policy check. READ ONLY: this script must never
// execute the actual deploy wrapper, Wrangler or a remote database command.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = new URL('../../../scripts/deploy-fire-dr-staging.sh', import.meta.url);
const source = readFileSync(file, 'utf8');

function verify(script) {
  assert.ok(script.startsWith('#!/usr/bin/env bash\nset -euo pipefail\n'), 'Deploy wrapper must fail on all shell errors');
  for (const pin of [
    'EXPECTED_BRANCH="fire-calculator-exact-live-clone"',
    'EXPECTED_WORKER="fire-app-independent-staging"',
    'EXPECTED_DB="fire-app-staging-db"',
    'EXPECTED_DB_ID="afb2c05a-d794-4a9a-b580-924ce01c26ad"',
    'APP_DIR="fire-app-dr"',
    'CONFIG="dist/server/wrangler.independent.json"',
  ]) assert.ok(script.includes(pin), 'Deployment identity pin missing: ' + pin);

  const branchGuard = script.indexOf('if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" || "$HEAD_SHA" != "$ORIGIN_SHA" ]]; then');
  const branchFailure = script.indexOf('exit 1', branchGuard);
  const appDirectory = script.indexOf('cd "$APP_DIR"');
  const configValidation = script.indexOf('if errors:');
  const migration = script.indexOf('pnpm exec wrangler d1 migrations apply "$EXPECTED_DB" --remote --config "$CONFIG"');
  const deployment = script.indexOf('pnpm exec wrangler deploy --config "$CONFIG"');

  assert.ok(branchGuard >= 0 && branchFailure > branchGuard && appDirectory > branchFailure,
    'A mismatched checkout must fail before entering the app');
  assert.ok(script.includes('CURRENT_BRANCH="$(git branch --show-current)"') &&
    script.includes('HEAD_SHA="$(git rev-parse HEAD)"') &&
    script.includes('ORIGIN_SHA="$(git rev-parse "origin/$EXPECTED_BRANCH")"'),
    'Branch and immutable commit check are required');
  assert.ok(configValidation > appDirectory && migration > configValidation && deployment > migration,
    'Remote migration and deployment must follow the target validation');
  assert.ok(script.includes("if c.get('name') != 'fire-app-independent-staging' or c.get('topLevelName') != 'fire-app-independent-staging'"),
    'Worker target and namespace must both be checked');
  assert.ok(script.includes("if len(dbs) != 1: errors.append('expected exactly one D1 binding')") &&
    script.includes("db.get('database_id') != 'afb2c05a-d794-4a9a-b580-924ce01c26ad'"),
    'D1 binding identity, count, and immutable resource ID must be checked');
  assert.ok(script.includes("if 'r2_buckets' in c: errors.append('R2 binding is not allowed in current DR staging')"),
    'Current no-R2 deployment policy cannot be silently removed');
  const provenance=[...script.matchAll(/python3 \.\.\/scripts\/verify-fire-dr-predeploy-provenance\.py/g)].map(match=>match.index);
  assert.equal(provenance.length,2,'Provenance must be verified twice');
  assert.ok(provenance[0]>appDirectory && provenance[0]<migration && provenance[1]>migration && provenance[1]<deployment,
    'Provenance must precede remote migration and be rechecked before deployment');
  assert.equal((script.match(/pnpm exec wrangler /g)||[]).length,2,
    'No unreviewed Wrangler action may be inserted in the governed wrapper');
  assert.ok(!/--skip(?:-|_)(?:check|verification|provenance)|--force/.test(script),
    'Unsafe bypass flags are forbidden');
}
verify(source);
const modify = (before, after, label) => {
  assert.ok(source.includes(before), 'Mutation target missing: '+label);
  assert.throws(()=>verify(source.replace(before,after)), label+' must be rejected');
};
modify('EXPECTED_BRANCH="fire-calculator-exact-live-clone"',
       'EXPECTED_BRANCH="work/fire-business-app-parity-2026-10-08"','development branch promotion');
modify('if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" || "$HEAD_SHA" != "$ORIGIN_SHA" ]]; then',
       '# branch and commit check disabled','branch/commit guard removed');
modify("db.get('database_id') != 'afb2c05a-d794-4a9a-b580-924ce01c26ad'",
       "db.get('database_id') != 'some-other-target'",'database identity drift');
modify("if 'r2_buckets' in c: errors.append('R2 binding is not allowed in current DR staging')",
       '# allow unverified storage binding','storage exception removed');
modify('pnpm exec wrangler deploy --config "$CONFIG"',
       'pnpm exec wrangler deploy --config "$CONFIG"\npnpm exec wrangler deploy --config "$CONFIG"',
       'additional deployment');
modify('python3 ../scripts/verify-fire-dr-predeploy-provenance.py\npnpm exec wrangler deploy',
       'pnpm exec wrangler deploy','post-migration provenance removed');
console.log('PASS: governed DR branch, commit, Worker/D1 resource, no-R2, two-phase provenance, remote-command ordering, and six fail-closed negative controls. No command executed or remote system contacted.');
