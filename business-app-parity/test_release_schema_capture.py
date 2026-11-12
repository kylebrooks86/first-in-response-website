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

# Negative control: a journal inserted out of sequence must NOT be normalized
# into apparent good order by sorting names. The owner capture must reveal
# actual D1 journal id order to the metadata verifier.
with sqlite3.connect(':memory:') as db:
    db.execute('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)')
    db.executemany('INSERT INTO d1_migrations(name) VALUES(?)',
                   [('0001_later.sql',), ('0000_earlier.sql',)])
    before = db.total_changes
    observed = [row[0] for row in db.execute(queries[4])]
    assert observed == ['0001_later.sql', '0000_earlier.sql'], observed
    assert observed != sorted(observed), 'Journal sequence must not be alphabetized'
    assert db.total_changes == before, 'The regression check must be read-only'
    checks += 1

print(f'PASS {checks}/{checks}: ten metadata/count-only SELECTs on three disposable schemas plus journal reordering negative control; no hosted access or writes.')
