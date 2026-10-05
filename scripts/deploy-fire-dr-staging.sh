#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="fire-calculator-exact-live-clone"
EXPECTED_WORKER="fire-app-independent-staging"
EXPECTED_DB="fire-app-staging-db"
EXPECTED_DB_ID="afb2c05a-d794-4a9a-b580-924ce01c26ad"
APP_DIR="fire-app-dr"
CONFIG="dist/server/wrangler.independent.json"

CURRENT_BRANCH="$(git branch --show-current)"
HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_SHA="$(git rev-parse "origin/$EXPECTED_BRANCH")"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" || "$HEAD_SHA" != "$ORIGIN_SHA" ]]; then
  echo "DR_DEPLOY_SOURCE=FAIL: deploy requires current origin/$EXPECTED_BRANCH" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR" ]]; then
  echo "DR_DEPLOY_SOURCE=FAIL: missing prepared $APP_DIR directory; run the governed prepare script first" >&2
  exit 1
fi

cd "$APP_DIR"
python3 ../scripts/verify-fire-dr-predeploy-provenance.py

python3 - <<'PY'
import json
from pathlib import Path
p = Path('dist/server/wrangler.independent.json')
if not p.exists():
    raise SystemExit('DR_DEPLOY_TARGET=FAIL: independent Wrangler config is missing')
c = json.loads(p.read_text())
dbs = c.get('d1_databases') or []
errors=[]
if c.get('name') != 'fire-app-independent-staging' or c.get('topLevelName') != 'fire-app-independent-staging': errors.append('unexpected Worker target')
if len(dbs) != 1: errors.append('expected exactly one D1 binding')
else:
    db=dbs[0]
    if db.get('binding') != 'DB' or db.get('database_name') != 'fire-app-staging-db' or db.get('database_id') != 'afb2c05a-d794-4a9a-b580-924ce01c26ad': errors.append('unexpected D1 target')
if 'r2_buckets' in c: errors.append('R2 binding is not allowed in current DR staging')
if errors:
    print('DR_DEPLOY_TARGET=FAIL')
    for e in errors: print('- '+e)
    raise SystemExit(1)
print('DR_DEPLOY_TARGET=PASS')
PY

pnpm exec wrangler d1 migrations apply "$EXPECTED_DB" --remote --config "$CONFIG"

# Re-check provenance after the remote migration step and immediately before the
# Worker deployment. This catches local drift during the deploy sequence.
python3 ../scripts/verify-fire-dr-predeploy-provenance.py
pnpm exec wrangler deploy --config "$CONFIG"

echo "DR_STAGING_DEPLOY=PASS"
echo "Worker: $EXPECTED_WORKER"
echo "D1: $EXPECTED_DB ($EXPECTED_DB_ID)"
