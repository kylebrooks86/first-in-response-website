import hashlib
import json
import subprocess
from pathlib import Path

root = Path('.')
repo_root = Path('..')
route_path = root / 'app/api/dr-capture-identity/route.ts'
version_path = root / 'CURRENT_VERSION.json'
package_path = root / 'package.json'
registry_path = root / 'FORWARD_SYNC_APPROVED.json'

required = [version_path, package_path, registry_path]
missing = [str(p) for p in required if not p.is_file()]
if missing:
    raise SystemExit('DR_CAPTURE_IDENTITY_APPLY=FAIL: missing ' + ', '.join(missing))

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
if release != 'v138' or package_version != '1.0.0-rc.138':
    raise SystemExit(
        f'DR_CAPTURE_IDENTITY_APPLY=FAIL: unexpected release identity '
        f'{release!r} / {package_version!r}'
    )

identity_material = (
    source_commit + '\n' +
    release + '\n' +
    package_version + '\n' +
    registry_hash + '\n' +
    'fire-app-independent-staging\n'
).encode()
capture_id = hashlib.sha256(identity_material).hexdigest()[:24]

route = f'''import {{ getOwnerUser }} from "../../owner-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
const CAPTURE_IDENTITY = {{
  schemaVersion: 1,
  environment: "independent-dr-staging",
  worker: "fire-app-independent-staging",
  sourceCommit: "{source_commit}",
  release: "{release}",
  packageVersion: "{package_version}",
  captureId: "{capture_id}",
  forwardSyncRegistrySha256: "{registry_hash}",
  production: false,
  photoStorageR2Provisioned: false,
}} as const;

async function authorized() {{
  const user = await getOwnerUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}}

export async function GET() {{
  if (!await authorized()) {{
    return Response.json({{ error: "Unauthorized" }}, {{ status: 401 }});
  }}
  return Response.json(CAPTURE_IDENTITY, {{
    headers: {{
      "cache-control": "no-store, max-age=0",
    }},
  }});
}}
'''

route_path.parent.mkdir(parents=True, exist_ok=True)
route_path.write_text(route)
print('DR_CAPTURE_IDENTITY_APPLY=PASS')
print(f'Capture identity {capture_id} bound to staging source commit {source_commit}.')
