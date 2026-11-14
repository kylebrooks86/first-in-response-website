"""Compare saved remote column names with disposable candidate migration output.

No network, external database, records, secrets, or writes are used.
This checks names only; indexes/types/journals/isolation remain unverified.
"""
import argparse
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent


def compare(evidence, expected):
    problems = []
    if evidence.get('projectId') != 'appgprj_6ac7e8e358dc81918d0a47c4034c4a41' or evidence.get('binding') != 'DB':
        problems.append('wrong staging project or binding')
    observed = {}
    for table in evidence['tables']:
        name, columns = table['name'], table['columns']
        if name in observed:
            problems.append(f'duplicate table: {name}')
        observed[name] = columns
        if table.get('omittedColumns') != 0:
            problems.append(f'incomplete column projection: {name}')
        if len(columns) != len(set(columns)):
            problems.append(f'duplicate columns: {name}')
    for name in sorted(set(expected) | set(observed)):
        if name not in expected:
            problems.append(f'unexpected table: {name}')
        elif name not in observed:
            problems.append(f'missing table: {name}')
        elif set(expected[name]) != set(observed[name]):
            problems.append(f'column mismatch: {name}')
    return {'columnNamesMatch': not problems, 'tablesChecked': len(expected),
            'candidateColumns': sum(map(len, expected.values())), 'problems': problems,
            'completeRemoteSchemaVerified': False, 'productionReady': False}


def expected_columns():
    with sqlite3.connect(':memory:') as database:
        for migration in sorted((ROOT / 'adapters/staging/drizzle').glob('*.sql')):
            database.executescript(migration.read_text())
        names = [row[0] for row in database.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        # Names come from the local migration output; quote identifiers defensively.
        return {name: [row[1] for row in database.execute(
            'PRAGMA table_info("' + name.replace('"', '""') + '")')] for name in names}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence', nargs='?', type=Path, default=ROOT / 'STAGING_COLUMNS_EVIDENCE.json')
    args = parser.parse_args()
    report = compare(json.loads(args.evidence.read_text()), expected_columns())
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['columnNamesMatch'] else 1)
