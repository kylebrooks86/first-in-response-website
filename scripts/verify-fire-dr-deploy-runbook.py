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
expected_queue='python3 scripts/report-fire-dr-evidence-capture-queue.py'
expected_register='python3 scripts/register-fire-dr-independent-evidence.py --entry-id <formal-id> --file <screenshot> --capture-id <capture-id> --notes "Exact DR state captured to match registered LIVE evidence."'
expected_identical='python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result identical --notes "Exact registered LIVE and DR pair reviewed." --visual-review-complete --functional-review-complete'
expected_mismatch='python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result mismatch --notes "Describe the exact rendered or functional difference."'
expected_forward_synced='python3 scripts/record-fire-dr-forward-sync.py --entry-id <forward-sync-id> --result synced --notes "Describe the verified LIVE upgrade." --same-device-render-reviewed --functional-review-complete --live-screenshot-sha256 <sha256> --dr-screenshot-sha256 <sha256>'
expected_forward_reopen='python3 scripts/record-fire-dr-forward-sync.py --entry-id <forward-sync-id> --result reopen --notes "Describe the LIVE regression or reason for reopening."'
expected_predeploy='python3 ../scripts/verify-fire-dr-predeploy-provenance.py'
expected_migrate='pnpm exec wrangler d1 migrations apply "$EXPECTED_DB" --remote --config "$CONFIG"'
expected_deploy='pnpm exec wrangler deploy --config "$CONFIG"'
for label,needle in [
 ('governed staging build command',expected_build),('single governed deploy wrapper command',expected_wrapper),
 ('capture queue command',expected_queue),('capture identity endpoint','https://fire-app-independent-staging.kyle-bfc.workers.dev/api/dr-capture-identity'),('capture identity is owner-authenticated','is owner-authenticated'),('capture identity no-store policy','is marked no-store'),('independent evidence registrar command',expected_register),
 ('explicit identical comparison command',expected_identical),('explicit mismatch comparison command',expected_mismatch),
 ('explicit forward-sync completion command',expected_forward_synced),('explicit forward-sync reopen command',expected_forward_reopen),
 ('forward-sync completion requires rendered and functional review','It never marks a state synchronized from source inspection alone.'),
 ('forward-sync recorder exact screenshot evidence','records the exact LIVE/DR screenshot SHA-256 pair plus an append-only sync history'),
 ('forward-sync recorder rollback safety','rolls all touched files back if any verification fails.'),
 ('evidence replacement invalidates prior comparison','Replacing either DR evidence file invalidates the old comparison and requires fresh review.'),
 ('no automatic comparison promotion','`VERIFIED_IDENTICAL` is never inferred merely because both screenshots exist.'),
 ('independent Worker name','fire-app-independent-staging'),('isolated D1 database name','fire-app-staging-db'),
 ('isolated D1 database id','afb2c05a-d794-4a9a-b580-924ce01c26ad'),('D1-only/no-R2 rule','free-tier, D1-only, no R2'),
 ('production isolation rule','Do not point the staging Worker at any production database.'),
 ('migration count/range','22 canonical migrations, `0000` through `0021`'),
 ('migration staging count','stages the exact 22 migrations'),
 ('tipping final-balance-only rule','Optional tipping is intentionally available only on the final balance card payment'),
 ('tipping default/presets','No tip is selected by default, with 5% / 10% / 15% / Custom choices.'),
 ('deposit tipping prohibition','Deposits do not offer or accept tips.'),
 ('separate tip accounting','FIRE records Tip / Tip Refund separately'),
 ('tip forward-sync blocker','tipping remains a `PENDING_LIVE_SYNC` forward-sync blocker.'),
 ('safe tip refund workflow',"initiate any refund from FIRE's Payment History"),
 ('combined Stripe-dashboard tip refund warning','Do not use a single combined Stripe Dashboard refund as the normal tipping-refund workflow')]:
    if needle not in text: errors.append(f'runbook missing {label}: {needle}')

# Runbook exposes only the wrapper for remote deployment; evidence commands are
# local governance operations and must never contain raw Wrangler mutations.
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
print('Runbook exposes one governed deploy wrapper plus authenticated build-bound capture identity, exact capture/register/review and forward-sync completion/reopen commands, and the governed final-balance tipping rules; comparison/synchronization promotion remains explicit and reviewed, and remote deploy order stays provenance -> isolated D1 migration -> provenance -> independent Worker deploy.')
