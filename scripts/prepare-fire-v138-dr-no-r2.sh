#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip"
EXPECTED_SHA256="2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca"
APP_DIR="fire-app-dr"
GOVERNANCE_OVERLAY_DIR="dr-parity-overlays"

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

# The sealed archive is the immutable application baseline, but current DR-only
# governance/audit documents intentionally live outside fire-app-dr because this
# directory is deleted and re-extracted on every build. Restore those documents
# into the fresh working tree before any consistency guard runs.
for doc in STRICT_RENDERED_PARITY_QUEUE.md STRICT_PARITY_MATRIX.md GO_NO_GO.md INDEPENDENT_DEPLOYMENT.md LIVE_PARITY_BATCH_AUDIT_2026-10-04.md; do
  source_path="$GOVERNANCE_OVERLAY_DIR/$doc"
  if [[ ! -f "$source_path" ]]; then
    echo "Missing persistent DR governance overlay: $source_path" >&2
    exit 1
  fi
  cp "$source_path" "$APP_DIR/$doc"
done
echo "Restored persistent DR governance/audit overlays after sealed extraction."

cd "$APP_DIR"
node -e "const p=require('./package.json'); if(p.version!=='1.0.0-rc.138') throw new Error('Unexpected package version: '+p.version)"
node -e "const v=require('./CURRENT_VERSION.json'); if(String(v.fire_release)!=='v138') throw new Error('Unexpected FIRE release: '+v.fire_release)"

# DR-only 4-digit PIN overlay. The sealed v138 package remains untouched.
python3 - <<'PY'
from pathlib import Path

PIN_HASH = "a20a2b7bb0842d5cf8a0c06c626421fd51ec103925c1819a51271f2779afa730"

p = Path("app/owner-auth.ts")
s = p.read_text()
start = s.index("export async function verifyIndependentPassword")
end = s.index("\n}", start) + 2
replacement = f'''export async function verifyIndependentPassword(pin: string) {{
  if (!/^\\d{{4}}$/.test(pin)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(pin)));
  const suppliedHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(suppliedHash, "{PIN_HASH}");
}}'''
s = s[:start] + replacement + s[end:]
p.write_text(s)

login = Path("app/login/page.tsx")
text = login.read_text()
text = text.replace("Enter the owner password to access business records.", "Enter your 4-digit PIN to access business records.")
text = text.replace("Owner password", "4-digit PIN")
text = text.replace('type="password" autoComplete="current-password"', 'type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off"')
login.write_text(text)

print("DR_PIN_OVERLAY_APPLIED")
PY

# Match LIVE mobile-shell behavior and repair the Stride control without legacy CSS conflicts.
python3 ../scripts/apply-fire-dr-mobile-shell-fix.py

# Match LIVE mobile template selection/editing behavior without altering the sealed v138 archive.
python3 ../scripts/apply-fire-dr-template-parity-fix.py

# Apply small content/UI corrections backed by stored LIVE screenshots/evidence.
python3 ../scripts/apply-fire-dr-live-evidence-fixes.py

# Refuse rebuilds where applying the DR overlays again changes the working tree.
# This catches accidental duplicate CSS/scripts or non-idempotent patch logic.
python3 ../scripts/verify-fire-dr-overlay-idempotency.py

# Refuse a DR build if known LIVE-parity behavior/wording regresses.
python3 ../scripts/verify-fire-dr-live-parity-overlays.py

# Protect owner-side Business/Templates/invoice/refund parity contracts while visual proof is pending.
python3 ../scripts/verify-fire-dr-owner-workflows.py

# Protect the complete LIVE-captured Create Estimate service catalog and ordering.
python3 ../scripts/verify-fire-dr-live-service-catalog.py

# Ensure every formal state that already has LIVE evidence is explicitly covered
# by the current DR parity work. New LIVE captures intentionally stop the build
# until this coverage map is updated.
python3 ../scripts/verify-fire-dr-live-evidence-coverage.py

# Protect customer approval/payment/document states and DR recovery-edge safeguards.
python3 ../scripts/verify-fire-dr-customer-workflows.py

# Keep the 32-state formal ledger, evidence-object integrity, checklist, release
# summary, strict verdict, 95-state queue status, scroll freeze, and DR photo
# capability disclosure synchronized before spending time on dependency install.
python3 ../scripts/verify-fire-dr-parity-ledger-consistency.py

echo "DR_PREBUILD_PARITY_GATES=PASS"

corepack enable
pnpm install --frozen-lockfile
pnpm run build

node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

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
config.vars = { ...(config.vars || {}), FIRE_SESSION_SECRET: randomBytes(32).toString('hex') };
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
