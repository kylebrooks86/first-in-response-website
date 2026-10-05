import re
from pathlib import Path

runbook = Path('../dr-parity-overlays/INDEPENDENT_DEPLOYMENT.md')
if not runbook.exists():
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    print(f'- missing persistent runbook: {runbook}')
    raise SystemExit(1)

text = runbook.read_text()
errors: list[str] = []

expected_build = 'git fetch origin fire-calculator-exact-live-clone && git checkout fire-calculator-exact-live-clone && bash scripts/prepare-fire-v138-dr-no-r2.sh'
expected_migrate = 'pnpm exec wrangler d1 migrations apply fire-app-staging-db --remote --config dist/server/wrangler.independent.json'
expected_deploy = 'pnpm exec wrangler deploy --config dist/server/wrangler.independent.json'
expected_worker = 'fire-app-independent-staging'
expected_db = 'fire-app-staging-db'
expected_db_id = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'

for label, needle in [
    ('governed staging build command', expected_build),
    ('isolated D1 migration command', expected_migrate),
    ('independent Wrangler deploy command', expected_deploy),
    ('independent Worker name', expected_worker),
    ('isolated D1 database name', expected_db),
    ('isolated D1 database id', expected_db_id),
    ('D1-only/no-R2 rule', 'free-tier, D1-only, no R2'),
    ('production isolation rule', 'Do not point the staging Worker at any production database.'),
]:
    if needle not in text:
        errors.append(f'missing {label}: {needle}')

# Every documented executable Wrangler deploy must name the independent config.
for line in text.splitlines():
    stripped = line.strip()
    if 'wrangler deploy' in stripped and not stripped.startswith('#'):
        if '--config dist/server/wrangler.independent.json' not in stripped:
            errors.append(f'unsafe/ungoverned Wrangler deploy command: {stripped}')
    if 'wrangler d1 migrations apply' in stripped and not stripped.startswith('#'):
        if expected_db not in stripped or '--config dist/server/wrangler.independent.json' not in stripped or '--remote' not in stripped:
            errors.append(f'unsafe/ungoverned D1 migration command: {stripped}')

# Prevent common default-config deploy examples from being introduced into the
# active runbook, where they could accidentally target a non-DR Worker.
for pattern in [
    r'(?m)^\s*wrangler\s+deploy\s*$',
    r'(?m)^\s*pnpm\s+exec\s+wrangler\s+deploy\s*$',
    r'(?m)^\s*npx\s+wrangler\s+deploy\s*$',
]:
    if re.search(pattern, text):
        errors.append('default-config Wrangler deploy command is present in the DR runbook')

if errors:
    print('DR_DEPLOY_RUNBOOK_GUARD=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_DEPLOY_RUNBOOK_GUARD=PASS')
print('The governed runbook pins the staging branch, independent Wrangler config, isolated D1 database, remote migration target, no-R2 model, and production-isolation rule.')
