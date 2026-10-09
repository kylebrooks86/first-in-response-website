"""Check native Sites table-name evidence against an isolated candidate schema.

Reads saved metadata and local SQL only; no network or operational database.
A matching table list never proves types, indexes, journal, isolation or readiness.
"""
import argparse
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent
PROJECT_IDS = {
    'live': 'appgprj_6aaf416f82c88191a292fa2e13a9ea61',
    'staging': 'appgprj_6ac7e8e358dc81918d0a47c4034c4a41',
}


def expected_tables(target):
    if target not in PROJECT_IDS:
        raise ValueError('No verified native Sites identity for this target.')
    migrations = sorted((ROOT / 'adapters' / target / 'drizzle').glob('*.sql'))
    if not migrations:
        raise ValueError('Candidate migration inputs are missing.')
    with sqlite3.connect(':memory:') as fixture:
        for migration in migrations:
            fixture.executescript(migration.read_text())
        return sorted(row[0] for row in fixture.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))


def compare(overview, target, expected):
    if target not in PROJECT_IDS:
        raise ValueError('No verified native Sites identity for this target.')
    problems = []
    if not isinstance(overview, dict):
        overview = {}
        problems.append('invalid table overview')
    if overview.get('project_id') != PROJECT_IDS[target]:
        problems.append('wrong project identity')
    bindings = overview.get('bindings')
    if not isinstance(bindings, list) or 'DB' not in bindings or overview.get('selected_binding_name') != 'DB':
        problems.append('wrong or missing DB binding')
    projection = overview.get('model_projection')
    if not isinstance(projection, dict) or any(
        type(projection.get(key)) is not int or projection[key] != 0
        for key in ('omitted_bindings', 'omitted_tables')
    ) or any(projection.get(key) is not False for key in (
        'truncated', 'omitted_project_id', 'omitted_selected_binding'
    )):
        problems.append('incomplete or uncertain metadata projection')
    observed = overview.get('tables')
    if not isinstance(observed, list) or any(not isinstance(name, str) or not name for name in observed):
        observed = []
        problems.append('invalid table-name collection')
    if len(observed) != len(set(observed)):
        problems.append('duplicate table names')
    missing = sorted(set(expected) - set(observed))
    unexpected = sorted(set(observed) - set(expected))
    problems += [f'missing table: {name}' for name in missing]
    problems += [f'unexpected table: {name}' for name in unexpected]
    return {
        'target': target, 'projectId': overview.get('project_id'), 'binding': overview.get('selected_binding_name'),
        'tableNamesMatch': not problems, 'matchedTableNames': len(set(expected) & set(observed)),
        'candidateTableCount': len(expected), 'observedTableCount': len(observed),
        'missingTables': missing, 'unexpectedTables': unexpected, 'problems': problems,
        'completeRemoteSchemaVerified': False, 'resourceIsolationVerified': False,
        'migrationJournalVerified': False, 'productionReady': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, choices=sorted(PROJECT_IDS))
    parser.add_argument('--evidence', type=Path, default=ROOT / 'DEPLOYED_IDENTITY_TABLE_EVIDENCE.json')
    args = parser.parse_args()
    evidence = json.loads(args.evidence.read_text())
    report = compare(evidence[args.target]['tableOverview'], args.target, expected_tables(args.target))
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['tableNamesMatch'] else 1)
