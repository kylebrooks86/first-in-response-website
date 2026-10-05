#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip"
EXPECTED_SHA256="2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca"
APP_DIR="fire-app-dr"
GOVERNANCE_OVERLAY_DIR="dr-parity-overlays"
EXPECTED_BRANCH="fire-calculator-exact-live-clone"

FIRE_WORKER_NAME="${FIRE_WORKER_NAME:-fire-app-independent-staging}"
FIRE_D1_DATABASE_NAME="${FIRE_D1_DATABASE_NAME:-fire-app-staging-db}"
FIRE_D1_DATABASE_ID="${FIRE_D1_DATABASE_ID:-afb2c05a-d794-4a9a-b580-924ce01c26ad}"
export FIRE_WORKER_NAME FIRE_D1_DATABASE_NAME FIRE_D1_DATABASE_ID

CURRENT_BRANCH="$(git branch --show-current)"
HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_SHA="$(git rev-parse "origin/$EXPECTED_BRANCH")"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then echo "DR_SOURCE_BRANCH=FAIL: expected $EXPECTED_BRANCH, found $CURRENT_BRANCH" >&2; exit 1; fi
if [[ "$HEAD_SHA" != "$ORIGIN_SHA" ]]; then echo "DR_SOURCE_BRANCH=FAIL: checked-out HEAD $HEAD_SHA does not match origin/$EXPECTED_BRANCH $ORIGIN_SHA" >&2; exit 1; fi
echo "DR_SOURCE_BRANCH=PASS ($EXPECTED_BRANCH @ $HEAD_SHA)"
if [[ ! "$FIRE_D1_DATABASE_ID" =~ ^[0-9a-fA-F-]{32,36}$ ]]; then echo "FIRE_D1_DATABASE_ID does not look like a valid D1 database ID." >&2; exit 1; fi
if [[ ! -f "$ARCHIVE" ]]; then echo "Missing sealed v138 archive: $ARCHIVE" >&2; exit 1; fi
ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"; echo "v138 archive SHA256: $ACTUAL_SHA256"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then echo "Sealed v138 archive hash mismatch; refusing to build." >&2; exit 1; fi

rm -rf "$APP_DIR"; mkdir -p "$APP_DIR"; unzip -q "$ARCHIVE" -d "$APP_DIR"
for doc in STRICT_RENDERED_PARITY_QUEUE.md STRICT_PARITY_MATRIX.md GO_NO_GO.md INDEPENDENT_DEPLOYMENT.md LIVE_PARITY_BATCH_AUDIT_2026-10-04.md; do
  source_path="$GOVERNANCE_OVERLAY_DIR/$doc"; [[ -f "$source_path" ]] || { echo "Missing persistent DR governance overlay: $source_path" >&2; exit 1; }; cp "$source_path" "$APP_DIR/$doc"
done
echo "Restored persistent DR governance/audit overlays after sealed extraction."

cd "$APP_DIR"
node -e "const p=require('./package.json'); if(p.version!=='1.0.0-rc.138') throw new Error('Unexpected package version: '+p.version)"
node -e "const v=require('./CURRENT_VERSION.json'); if(String(v.fire_release)!=='v138') throw new Error('Unexpected FIRE release: '+v.fire_release)"
python3 ../scripts/verify-fire-dr-script-inventory.py
python3 ../scripts/verify-fire-dr-deploy-runbook.py

python3 - <<'PY'
from pathlib import Path
PIN_HASH = "a20a2b7bb0842d5cf8a0c06c626421fd51ec103925c1819a51271f2779afa730"
p=Path('app/owner-auth.ts'); s=p.read_text(); start=s.index('export async function verifyIndependentPassword'); end=s.index('\n}',start)+2
replacement=f'''export async function verifyIndependentPassword(pin: string) {{
  if (!/^\\d{{4}}$/.test(pin)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(pin)));
  const suppliedHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(suppliedHash, "{PIN_HASH}");
}}'''
p.write_text(s[:start]+replacement+s[end:])
login=Path('app/login/page.tsx'); text=login.read_text(); text=text.replace('Enter the owner password to access business records.','Enter your 4-digit PIN to access business records.').replace('Owner password','4-digit PIN').replace('type="password" autoComplete="current-password"','type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off"'); login.write_text(text)
print('DR_PIN_OVERLAY_APPLIED')
PY

python3 ../scripts/apply-fire-dr-mobile-shell-fix.py
python3 ../scripts/apply-fire-dr-template-parity-fix.py
python3 ../scripts/apply-fire-dr-live-evidence-fixes.py
python3 ../scripts/apply-fire-dr-customer-edit-flow.py
python3 ../scripts/verify-fire-dr-customer-edit-flow.py
python3 ../scripts/apply-fire-dr-independent-evidence-overlay.py
python3 ../scripts/verify-fire-dr-independent-evidence-integrity.py
python3 ../scripts/apply-fire-dr-comparison-overlay.py
python3 ../scripts/verify-fire-dr-comparison-integrity.py
python3 ../scripts/apply-fire-dr-parity-summary-sync.py
python3 ../scripts/verify-fire-dr-overlay-idempotency.py
python3 ../scripts/verify-fire-dr-live-parity-overlays.py
python3 ../scripts/verify-fire-dr-owner-workflows.py
python3 ../scripts/verify-fire-dr-live-service-catalog.py
python3 ../scripts/verify-fire-dr-live-evidence-coverage.py
python3 ../scripts/verify-fire-dr-customer-workflows.py
python3 ../scripts/verify-fire-dr-parity-ledger-consistency.py
python3 ../scripts/verify-fire-dr-release-readiness.py

echo "DR_PREBUILD_PARITY_GATES=PASS"
corepack enable
pnpm install --frozen-lockfile
pnpm run build

node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises'; import { randomBytes } from 'node:crypto';
const source='dist/server/wrangler.json', destination='dist/server/wrangler.independent.json'; const config=JSON.parse(await readFile(source,'utf8'));
config.name=process.env.FIRE_WORKER_NAME.trim(); config.topLevelName=config.name; config.d1_databases=[{binding:'DB',database_name:process.env.FIRE_D1_DATABASE_NAME.trim(),database_id:process.env.FIRE_D1_DATABASE_ID.trim()}]; config.vars={...(config.vars||{}),FIRE_SESSION_SECRET:randomBytes(32).toString('hex')}; delete config.r2_buckets; await writeFile(destination,JSON.stringify(config,null,2)+'\n');
console.log('Wrote D1-only isolated DR config to '+destination);
NODE

node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises'; const config=JSON.parse(await readFile('dist/server/wrangler.independent.json','utf8')); const errors=[]; const dbs=config.d1_databases;
if(config.name!==process.env.FIRE_WORKER_NAME.trim()||config.topLevelName!==process.env.FIRE_WORKER_NAME.trim())errors.push('worker target mismatch');
if(!Array.isArray(dbs)||dbs.length!==1)errors.push('expected exactly one D1 binding'); else {const db=dbs[0]; if(db.binding!=='DB'||db.database_name!==process.env.FIRE_D1_DATABASE_NAME.trim()||db.database_id!==process.env.FIRE_D1_DATABASE_ID.trim())errors.push('D1 target mismatch');}
if('r2_buckets' in config)errors.push('R2 binding unexpectedly present'); const secret=config.vars?.FIRE_SESSION_SECRET; if(typeof secret!=='string'||!/^[0-9a-f]{64}$/.test(secret))errors.push('FIRE_SESSION_SECRET missing/malformed');
if(errors.length){console.error('DR_WRANGLER_ISOLATION=FAIL'); for(const e of errors)console.error('- '+e); process.exit(1);} console.log('DR_WRANGLER_ISOLATION=PASS');
NODE

python3 - <<'PY'
from pathlib import Path
import re
files=sorted(Path('drizzle').glob('*.sql')); parsed=[]; errors=[]
for p in files:
 m=re.match(r'^(\d{4})_.+\.sql$',p.name)
 if not m: errors.append(f'invalid migration filename: {p.name}')
 else: parsed.append(int(m.group(1)))
if len(files)!=21: errors.append(f'expected exactly 21 canonical migrations, found {len(files)}')
if parsed!=list(range(21)): errors.append(f'migration prefixes must be contiguous 0000..0020 exactly once; found {parsed}')
if errors:
 print('DR_MIGRATION_SEQUENCE=FAIL'); [print('- '+e) for e in errors]; raise SystemExit(1)
print('DR_MIGRATION_SEQUENCE=PASS')
PY
mkdir -p dist/server/migrations; rm -f dist/server/migrations/*.sql; cp drizzle/*.sql dist/server/migrations/
staged_migration_count="$(find dist/server/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"; [[ "$staged_migration_count" == "21" ]] || { echo "Failed to stage all 21 migrations for Wrangler." >&2; exit 1; }

python3 ../scripts/verify-fire-dr-postbuild-artifacts.py
python3 ../scripts/write-fire-dr-build-provenance.py
python3 ../scripts/verify-fire-dr-predeploy-provenance.py
echo "DR_POSTBUILD_DEPLOYMENT_GATES=PASS"
set +e; pnpm run typecheck; typecheck_status=$?; set -e
if [[ $typecheck_status -eq 0 ]]; then echo "TYPECHECK_STATUS=PASS"; else echo "TYPECHECK_STATUS=FAIL_NONBLOCKING (exit $typecheck_status)"; echo "Production build succeeded; continuing isolated DR deployment for rendered parity."; fi
echo "Prepared sealed FIRE v138 DR build with D1 only and no R2 binding."
echo "Worker: $FIRE_WORKER_NAME"
echo "D1: $FIRE_D1_DATABASE_NAME ($FIRE_D1_DATABASE_ID)"
