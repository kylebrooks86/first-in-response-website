import json
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
inventory_path = scripts_dir / 'FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'

if not inventory_path.exists():
    print('DR_SCRIPT_INVENTORY=FAIL')
    print(f'- missing inventory: {inventory_path}')
    raise SystemExit(1)

inventory = json.loads(inventory_path.read_text())
names = inventory.get('scripts')
errors = []
if inventory.get('schema_version') != 1:
    errors.append(f"unexpected inventory schema_version: {inventory.get('schema_version')!r}")
if not isinstance(names, list) or not names:
    errors.append('inventory scripts must be a non-empty array')
    names = []
if any(not isinstance(name, str) or not name for name in names):
    errors.append('inventory contains an invalid script name')
if len(names) != len(set(names)):
    errors.append('inventory contains duplicate script names')

listed = set(names)
discovered = {
    path.name
    for path in scripts_dir.iterdir()
    if path.is_file()
    and (
        path.name.startswith('apply-fire-dr-')
        or path.name.startswith('verify-fire-dr-')
        or path.name.startswith('write-fire-dr-')
        or path.name.startswith('deploy-fire-dr-')
        or path.name == 'prepare-fire-v138-dr-no-r2.sh'
    )
}

unlisted = sorted(discovered - listed)
missing = sorted(listed - discovered)
if unlisted:
    errors.append('unregistered DR scripts: ' + ', '.join(unlisted))
if missing:
    errors.append('inventory entries missing from scripts directory: ' + ', '.join(missing))

if errors:
    print('DR_SCRIPT_INVENTORY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_SCRIPT_INVENTORY=PASS')
print(f'All {len(discovered)} DR preparation/overlay/verification/provenance/deploy scripts are explicitly governed.')
