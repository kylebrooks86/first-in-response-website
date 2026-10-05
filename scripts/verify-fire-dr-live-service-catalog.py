import re
from pathlib import Path

path = Path('lib/fire-services.ts')
if not path.exists():
    raise SystemExit('lib/fire-services.ts not found')

text = path.read_text()
actual = re.findall(r'\n\s*name:\s*"([^"]+)",', text)
expected = [
    'House Wash',
    'Soft-Wash Roof Cleaning',
    'Gutter Cleaning + Flush',
    'Remove & Reinstall Existing Gutter Guards',
    'Gutter Brightening',
    'Driveway / Concrete Cleaning',
    'Deck / Patio Cleaning',
    'Fence Cleaning',
    '1st Floor Exterior Windows',
    '2nd Floor Exterior Windows',
    '1st Floor Exterior French-Pane Windows',
    '2nd Floor Exterior French-Pane Windows',
    '1st Floor Window Screen Cleaning',
    '2nd Floor Window Screen Cleaning',
    '1st Floor Deep Exterior Window Frame & Sill Cleaning',
    '2nd Floor Deep Exterior Window Frame & Sill Cleaning',
    'Window Frame Oxidation Removal',
    'Trash Bin Cleaning',
    'Underground Downspout Flush — First Line',
    'Additional Underground Line — Same Visit',
    'French Drain Flush',
    'Premium Fence Restoration',
    'AC Condenser Rinse Add-On',
    'RV / Boat / Trailer / Work Vehicle Wash',
    'Detailed Cobweb Removal Add-On',
    'Dryer Vent Cleaning',
    'Seasonal / Holiday Lighting',
    'Commercial Exterior Cleaning',
    'Specialty Exterior Service',
    'Custom Service',
]

if actual != expected:
    print('DR_LIVE_SERVICE_CATALOG_PARITY=FAIL')
    print(f'Expected {len(expected)} LIVE-captured service options in exact order; found {len(actual)}.')
    max_len = max(len(expected), len(actual))
    for index in range(max_len):
        wanted = expected[index] if index < len(expected) else '<none>'
        found = actual[index] if index < len(actual) else '<missing>'
        if wanted != found:
            print(f'- position {index + 1}: expected {wanted!r}, found {found!r}')
    raise SystemExit(1)

print('DR_LIVE_SERVICE_CATALOG_PARITY=PASS')
print(f'Protected all {len(expected)} service options and their LIVE-captured ordering.')
print('This guard protects catalog parity only; it does not claim rendered FULL_IDENTICAL status.')
