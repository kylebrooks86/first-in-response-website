import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path('.')
repo_root = Path('..')
route_path = root / 'app/api/dr-capture-identity/route.ts'
version_path = root / 'CURRENT_VERSION.json'
package_path = root / 'package.json'
registry_path = root / 'FORWARD_SYNC_APPROVED.json'

required = [route_path, version_path, package_path, registry_path]
missing = [str(p) for p in required if not p.is_file()]
if missing:
    print('DR_CAPTURE_IDENTITY_GUARD=FAIL')
    for item in missing:
        print(f'- missing capture-identity input: {item}')
    raise SystemExit(1)

source_commit = subprocess.check_output(
    ['git', 'rev-parse', 'HEAD'],
    cwd=repo_root,
    text=True,
).strip()
version = json.loads(version_path.read_text())
package = json.loads(package_path.read_text())
registry_hash = hashlib.sha256(registry_path.read_bytes()).hexdigest()
release = str(version.get('fire_release') or '')
package_version = str(package.get('version') or '')

identity_material = (
    source_commit + '\n' +
    release + '\n' +
    package_version + '\n' +
    registry_hash + '\n' +
    'fire-app-independent-staging\n'
).encode()
capture_id = hashlib.sha256(identity_material).hexdigest()[:24]

text = route_path.read_text()
errors = []
needles = [
    'environment: "independent-dr-staging"',
    'worker: "fire-app-independent-staging"',
    f'sourceCommit: "{source_commit}"',
    f'release: "{release}"',
    f'packageVersion: "{package_version}"',
    f'captureId: "{capture_id}"',
    f'forwardSyncRegistrySha256: "{registry_hash}"',
    'production: false',
    'photoStorageR2Provisioned: false',
    'if (!await authorized())',
    'return Response.json({ error: "Unauthorized" }, { status: 401 })',
    '"cache-control": "no-store, max-age=0"',
]
for needle in needles:
    if needle not in text:
        errors.append(f'missing capture identity invariant: {needle}')

for forbidden in [
    'FIRE_SESSION_SECRET',
    'PIN_HASH',
    'password',
    'database_id',
    'stripe',
]:
    if forbidden.lower() in text.lower():
        errors.append(f'capture identity route must not expose or reference sensitive/runtime field: {forbidden}')

if not re.fullmatch(r'[0-9a-f]{40}', source_commit):
    errors.append(f'checked-out source commit is malformed: {source_commit!r}')
if release != 'v138' or package_version != '1.0.0-rc.138':
    errors.append(f'unexpected release identity {release!r} / {package_version!r}')

if errors:
    print('DR_CAPTURE_IDENTITY_GUARD=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_CAPTURE_IDENTITY_GUARD=PASS')
print(f'Authenticated non-visual capture identity {capture_id} matches source commit {source_commit}; no secret/PIN/payment/database identifiers are exposed.')
