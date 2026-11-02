"""SOURCE ONLY: make an isolated non-deployable Cloudflare FIRE candidate.
Never run Wrangler, create D1, bind photos, migrate, or alter a hosted system.
Its built Vite config retains a LOCAL PLACEHOLDER UUID; a separate verified
production manifest, Access policies, migrations, backups and owner approval
are mandatory before ANY hosted release.
"""
import json, shutil, sys
from pathlib import Path

root=Path(__file__).resolve().parent.parent
if len(sys.argv)!=3 or sys.argv[1] not in ('staging','production'):
    raise SystemExit('Usage: materialize-cloudflare.py staging|production NEW_DIRECTORY')
mode=sys.argv[1]
destination=Path(sys.argv[2]).resolve()
if destination.exists():
    raise SystemExit('STOP: Existing directory never overwritten.')
if destination.is_relative_to(root):
    raise SystemExit('STOP: Output must be outside the source repository.')
shutil.copytree(root/'shared',destination)
shutil.rmtree(destination/'drizzle')
overlay=root/'adapters'/'live'
shutil.copytree(overlay,destination,dirs_exist_ok=True)
for relative in json.loads((overlay/'ABSENT_FILES.json').read_text()):
    p=destination/relative
    if p.exists():
        p.unlink()
(destination/'ABSENT_FILES.json').unlink()
launch=root/'cloudflare-launch'
for source,target in [
    ('app-auth.ts','app/chatgpt-auth.ts'),
    ('access-jwt.mjs','app/access-jwt.mjs'),
    ('access-jwt.d.mts','app/access-jwt.d.mts'),
    ('access-token.mjs','app/access-token.mjs'),
    ('access-token.d.mts','app/access-token.d.mts'),
    ('access-diagnostic.mjs','app/access-diagnostic.mjs'),
    ('access-diagnostic.d.mts','app/access-diagnostic.d.mts'),
    ('access-required-page.tsx','app/access-required/page.tsx')
]:
    to=destination/target
    to.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(launch/source,to)
if mode=='staging':
    shutil.copy2(root/'adapters'/'independent-staging'/'app'/'page.tsx',
                 destination/'app'/'page.tsx')
print('PASS: SOURCE-ONLY Cloudflare FIRE '+mode+' candidate. UNDEPLOYABLE.')
print('NO D1/Worker/Access/Stripe/secret/domain changes. QA, Sites LIVE and DR untouched.')
print('STOP: built local placeholder Wrangler is NOT a permitted production manifest.')
