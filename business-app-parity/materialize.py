from pathlib import Path
import json,shutil,sys
root=Path(__file__).resolve().parent
target=sys.argv[1]
if target not in ['live','doomsday','staging','qa']:raise SystemExit('Unknown target')
destination=Path(sys.argv[2]).resolve()
if destination.exists():raise SystemExit('Refusing existing destination')
shutil.copytree(root/'shared',destination)
overlays=[root/'adapters'/'doomsday',root/'adapters'/'qa'] if target=='qa' else [root/'adapters'/target]
shutil.rmtree(destination/'drizzle')
for overlay in overlays:
 shutil.copytree(overlay,destination,dirs_exist_ok=True)
 for path in json.loads((overlay/'ABSENT_FILES.json').read_text()):
  p=destination/path
  if p.exists():p.unlink()
(destination/'ABSENT_FILES.json').unlink()
print('Local-only candidate materialized; no deployment or resource connection performed.')
