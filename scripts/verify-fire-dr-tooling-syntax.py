import json
import py_compile
import subprocess
from pathlib import Path

repo_root = Path('..')
scripts_dir = repo_root / 'scripts'
inventory_path = scripts_dir / 'FIRE_DR_GOVERNED_SCRIPT_INVENTORY.json'

if not inventory_path.is_file():
    raise SystemExit('DR_TOOLING_SYNTAX=FAIL: missing governed script inventory')

inventory = json.loads(inventory_path.read_text())
names = inventory.get('scripts')
if not isinstance(names, list):
    raise SystemExit('DR_TOOLING_SYNTAX=FAIL: governed script inventory scripts must be an array')

errors = []
checked_python = 0
checked_shell = 0

for name in names:
    path = scripts_dir / str(name)
    if not path.is_file():
        errors.append(f'missing governed script: {name}')
        continue

    if path.suffix == '.py':
        try:
            py_compile.compile(str(path), doraise=True)
            checked_python += 1
        except py_compile.PyCompileError as exc:
            errors.append(f'Python syntax error in {name}: {exc.msg}')
    elif path.suffix == '.sh':
        result = subprocess.run(
            ['bash', '-n', str(path)],
            text=True,
            capture_output=True,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip() or f'exit {result.returncode}'
            errors.append(f'Shell syntax error in {name}: {detail}')
        else:
            checked_shell += 1

if errors:
    print('DR_TOOLING_SYNTAX=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_TOOLING_SYNTAX=PASS')
print(
    f'Governed tooling syntax verified: '
    f'{checked_python} Python script(s), {checked_shell} shell script(s).'
)
