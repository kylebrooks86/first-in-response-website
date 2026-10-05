import re
from pathlib import Path

runbook = Path('../dr-parity-overlays/INDEPENDENT_DEPLOYMENT.md')
deploy_script = Path('../scripts/deploy-fire-dr-staging.sh')
errors: list[str] = []

for path, label in [(runbook, 'persistent runbook'), (deploy_script, 'governed deploy wrapper')]:
    if not path.exists():
        errors.append(f'missing {label}: {path}')

if errors:
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    for error in errors: print(f'- {error}')
    raise SystemExit(1)

text = runbook.read_text()
deploy = deploy_script.read_text()
expected_build = 'git fetch origin fire-calculator-exact-live-clone && git checkout fire-calculator-exact-live-clone && bash scripts/prepare-fire-v138-dr-no-r2.sh'
expected_wrapper = 'bash scripts/deploy-fire-dr-staging.sh'
expected_predeploy = 'python3 ../scripts/verify-fire-dr-predeploy-provenance.py'
expected_migrate = 'pnpm exec wrangler d1 migrations apply "$EXPECTED_DB" --remote --config "$CONFIG"'
expected_deploy = 'pnpm exec wrangler deploy --config "$CONFIG"'

for label, needle in [
    ('governed staging build command', expected_build),
    ('single governed deploy wrapper command', expected_wrapper),
    ('independent Worker name', 'fire-app-independent-staging'),
    ('isolated D1 database name', 'fire-app-staging-db'),
    ('isolated D1 database id', 'afb2c05a-d794-4a9a-b580-924ce01c26ad'),
    ('D1-only/no-R2 rule', 'free-tier, D1-only, no R2'),
    ('production isolation rule', 'Do not point the staging Worker at any production database.'),
]:
    if needle not in text:
        errors.append(f'runbook missing {label}: {needle}')

# The runbook should expose one safe wrapper, not copy-pastable raw remote commands.
for line in text.splitlines():
    stripped = line.strip()
    if re.search(r'\bwrangler\s+(?:d1\s+migrations\s+apply|deploy)\b', stripped):
        errors.append(f'runbook contains raw remote Wrangler command instead of governed wrapper: {stripped}')

for label, needle in [
    ('staging branch pin', 'EXPECTED_BRANCH="fire-calculator-exact-live-clone"'),
    ('independent Worker pin', 'EXPECTED_WORKER="fire-app-independent-staging"'),
    ('isolated D1 pin', 'EXPECTED_DB="fire-app-staging-db"'),
    ('isolated D1 id pin', 'EXPECTED_DB_ID="afb2c05a-d794-4a9a-b580-924ce01c26ad"'),
    ('independent config pin', 'CONFIG="dist/server/wrangler.independent.json"'),
    ('predeploy provenance check', expected_predeploy),
    ('remote isolated D1 migration', expected_migrate),
    ('independent Worker deploy', expected_deploy),
    ('post-migration provenance comment', 'Re-check provenance after the remote migration step'),
    ('successful deploy marker', 'DR_STAGING_DEPLOY=PASS'),
]:
    if needle not in deploy:
        errors.append(f'deploy wrapper missing {label}: {needle}')

if deploy.count(expected_predeploy) < 2:
    errors.append('deploy wrapper must run provenance verification both before remote migration and immediately before Worker deploy')
if deploy.find(expected_predeploy) > deploy.find(expected_migrate):
    errors.append('first provenance verification must occur before remote D1 migration')
if deploy.rfind(expected_predeploy) < deploy.find(expected_migrate) or deploy.rfind(expected_predeploy) > deploy.find(expected_deploy):
    errors.append('second provenance verification must occur after migration and before Worker deploy')

# Block common unsafe/default deploy forms inside the governed wrapper.
for pattern in [
    r'(?m)^\s*(?:pnpm\s+exec\s+|npx\s+)?wrangler\s+deploy\s*$',
    r'(?m)^\s*(?:pnpm\s+exec\s+|npx\s+)?wrangler\s+d1\s+migrations\s+apply\s+[^\n]*$(?![^\n]*--config)',
]:
    if re.search(pattern, deploy):
        errors.append('deploy wrapper contains an unpinned/default Wrangler command')

if errors:
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    for error in errors: print(f'- {error}')
    raise SystemExit(1)

print('DR_DEPLOY_RUNBOOK_GUARD=PASS')
print('The runbook exposes only the governed DR deploy wrapper; the wrapper pins current staging source, independent Worker/D1/config, verifies provenance before migration and again before deploy, and retains the no-R2/production-isolation boundary.')
