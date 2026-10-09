"""Verify the owner metadata capture queries on disposable SQLite, never Cloudflare."""
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parent
text = (ROOT / 'RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql').read_text()
queries = [s.strip() for s in re.sub(r'--[^\n]*', '', text).split(';') if s.strip()]
assert len(queries) == 10
checks = 0
for target in ('live', 'doomsday', 'staging'):
    with sqlite3.connect(':memory:') as db:
        files = sorted((ROOT / 'adapters' / target / 'drizzle').glob('*.sql'))
        for path in files:
            db.executescript(path.read_text())
        db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)')
        db.executemany('INSERT INTO d1_migrations(name) VALUES(?)', [(p.name,) for p in files])
        before = list(db.iterdump())
        changes = db.total_changes
        for index, query in enumerate(queries):
            assert re.match(r'^SELECT\s', query, re.I), 'Capture must remain SELECT-only'
            rows = db.execute(query).fetchall()
            assert list(db.iterdump()) == before
            assert db.total_changes == changes
            if index >= 5:
                assert rows == [(0,)], 'Empty synthetic fixtures must have no anomalies'
            checks += 1
print(f'PASS {checks}/{checks}: ten metadata/count-only SELECT statements execute on three disposable target schemas without changing schema, journal or records; no remote access.')
