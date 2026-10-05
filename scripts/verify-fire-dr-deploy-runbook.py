import re
from pathlib import Path

runbook=Path('../dr-parity-overlays/INDEPENDENT_DEPLOYMENT.md'); deploy_script=Path('../scripts/deploy-fire-dr-staging.sh'); errors=[]
for path,label in [(runbook,'persistent runbook'),(deploy_script,'governed deploy wrapper')]:
    if not path.exists(): errors.append(f'missing {label}: {path}')
if errors:
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    for e in errors: print(f'- {e}')
    raise SystemExit(1)
text=runbook.read_text(); deploy=deploy_script.read_text()
expected_build='git fetch origin fire-calculator-exact-live-clone && git checkout fire-calculator-exact-live-clone && bash scripts/prepare-fire-v138-dr-no-r2.sh'
expected_wrapper='bash scripts/deploy-fire-dr-staging.sh'
expected_predeploy='python3 ../scripts/verify-fire-dr-predeploy-provenance.py'
expected_migrate='pnpm exec wrangler d1 migrations apply "$EXPECTED_DB" --remote --config "$CONFIG"'
expected_deploy='pnpm exec wrangler deploy --config "$CONFIG"'
for label,needle in [
 ('governed staging build command',expected_build),('single governed deploy wrapper command',expected_wrapper),
 ('independent Worker name','fire-app-independent-staging'),('isolated D1 database name','fire-app-staging-db'),
 ('isolated D1 database id','afb2c05a-d794-4a9a-b580-924ce01c26ad'),('D1-only/no-R2 rule','free-tier, D1-only, no R2'),
 ('production isolation rule','Do not point the staging Worker at any production database.')]:
    if needle not in text: errors.append(f'runbook missing {label}: {needle}')

# Runbook exposes only the wrapper; no copy-pastable remote Wrangler commands.
for line in text.splitlines():
    stripped=line.strip()
    if re.search(r'\bwrangler\s+(?:d1\s+migrations\s+apply|deploy)\b',stripped): errors.append(f'runbook contains raw remote Wrangler command: {stripped}')

for label,needle in [
 ('staging branch pin','EXPECTED_BRANCH="fire-calculator-exact-live-clone"'),('independent Worker pin','EXPECTED_WORKER="fire-app-independent-staging"'),
 ('isolated D1 pin','EXPECTED_DB="fire-app-staging-db"'),('isolated D1 id pin','EXPECTED_DB_ID="afb2c05a-d794-4a9a-b580-924ce01c26ad"'),
 ('independent config pin','CONFIG="dist/server/wrangler.independent.json"'),('predeploy provenance check',expected_predeploy),
 ('remote isolated D1 migration',expected_migrate),('independent Worker deploy',expected_deploy),
 ('post-migration provenance comment','Re-check provenance after the remote migration step'),('successful deploy marker','DR_STAGING_DEPLOY=PASS')]:
    if needle not in deploy: errors.append(f'deploy wrapper missing {label}: {needle}')

if deploy.count(expected_predeploy)<2: errors.append('deploy wrapper must verify provenance before migration and again before Worker deploy')
first=deploy.find(expected_predeploy); migrate=deploy.find(expected_migrate); second=deploy.rfind(expected_predeploy); worker=deploy.find(expected_deploy)
if min(first,migrate,second,worker)<0 or not (first<migrate<second<worker): errors.append('deploy wrapper command order must be provenance -> migration -> provenance -> Worker deploy')

# Validate every executable Wrangler line in the wrapper instead of relying on
# a fragile regex negative-lookahead. Any extra/unpinned command is a failure.
wrangler_lines=[line.strip() for line in deploy.splitlines() if 'wrangler ' in line and not line.lstrip().startswith('#')]
if wrangler_lines != [expected_migrate, expected_deploy]: errors.append('deploy wrapper Wrangler command set/order differs from the two governed commands')
for line in wrangler_lines:
    if 'd1 migrations apply' in line and not ('$EXPECTED_DB' in line and '--remote' in line and '--config "$CONFIG"' in line): errors.append(f'unpinned D1 migration command: {line}')
    if 'wrangler deploy' in line and '--config "$CONFIG"' not in line: errors.append(f'unpinned Worker deploy command: {line}')

if errors:
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    for e in errors: print(f'- {e}')
    raise SystemExit(1)
print('DR_DEPLOY_RUNBOOK_GUARD=PASS')
print('Runbook exposes only the governed wrapper; wrapper command order is provenance -> isolated D1 migration -> provenance -> independent Worker deploy, with no extra/default Wrangler commands.')
