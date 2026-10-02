#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip"
EXPECTED_SHA256="2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca"
APP_DIR="fire-app-dr"

FIRE_WORKER_NAME="${FIRE_WORKER_NAME:-fire-app-independent-staging}"
FIRE_D1_DATABASE_NAME="${FIRE_D1_DATABASE_NAME:-fire-app-staging-db}"
FIRE_D1_DATABASE_ID="${FIRE_D1_DATABASE_ID:-afb2c05a-d794-4a9a-b580-924ce01c26ad}"
export FIRE_WORKER_NAME FIRE_D1_DATABASE_NAME FIRE_D1_DATABASE_ID

if [[ ! "$FIRE_D1_DATABASE_ID" =~ ^[0-9a-fA-F-]{32,36}$ ]]; then
  echo "FIRE_D1_DATABASE_ID does not look like a valid D1 database ID." >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Missing sealed v138 archive: $ARCHIVE" >&2
  exit 1
fi

ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
echo "v138 archive SHA256: $ACTUAL_SHA256"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "Sealed v138 archive hash mismatch; refusing to build." >&2
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
unzip -q "$ARCHIVE" -d "$APP_DIR"

cd "$APP_DIR"
node -e "const p=require('./package.json'); if(p.version!=='1.0.0-rc.138') throw new Error('Unexpected package version: '+p.version)"
node -e "const v=require('./CURRENT_VERSION.json'); if(String(v.fire_release)!=='v138') throw new Error('Unexpected FIRE release: '+v.fire_release)"

# Temporary DR-only auth discovery. This prints source locations and nearby code,
# but never prints runtime secret values. It lets us replace the password flow
# precisely instead of weakening unrelated authorization logic.
echo "AUTH_DISCOVERY_BEGIN"
grep -R -n -C 6 \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  -E 'FIRE_ADMIN_PASSWORD_HASH|FIRE_SESSION_SECRET|Private FIRE app|Owner password' . || true
echo "AUTH_DISCOVERY_END"

corepack enable
pnpm install --frozen-lockfile
pnpm run build

node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';

const source = 'dist/server/wrangler.json';
const destination = 'dist/server/wrangler.independent.json';
const config = JSON.parse(await readFile(source, 'utf8'));

config.name = process.env.FIRE_WORKER_NAME.trim();
config.topLevelName = config.name;
config.d1_databases = [{
  binding: 'DB',
  database_name: process.env.FIRE_D1_DATABASE_NAME.trim(),
  database_id: process.env.FIRE_D1_DATABASE_ID.trim(),
}];

delete config.r2_buckets;

await writeFile(destination, JSON.stringify(config, null, 2) + '\n');
console.log('Wrote D1-only isolated DR config to ' + destination);
NODE

migration_count="$(find drizzle -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "$migration_count" != "21" ]]; then
  echo "Expected exactly 21 canonical migrations, found $migration_count; refusing to deploy." >&2
  exit 1
fi
mkdir -p dist/server/migrations
rm -f dist/server/migrations/*.sql
cp drizzle/*.sql dist/server/migrations/
staged_migration_count="$(find dist/server/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "$staged_migration_count" != "21" ]]; then
  echo "Failed to stage all 21 migrations for Wrangler." >&2
  exit 1
fi
echo "Staged 21 canonical D1 migrations at dist/server/migrations."

set +e
pnpm run typecheck
typecheck_status=$?
set -e
if [[ $typecheck_status -eq 0 ]]; then
  echo "TYPECHECK_STATUS=PASS"
else
  echo "TYPECHECK_STATUS=FAIL_NONBLOCKING (exit $typecheck_status)"
  echo "Production build succeeded; continuing isolated DR deployment for rendered parity."
fi

echo "Prepared sealed FIRE v138 DR build with D1 only and no R2 binding."
echo "Worker: $FIRE_WORKER_NAME"
echo "D1: $FIRE_D1_DATABASE_NAME ($FIRE_D1_DATABASE_ID)"
