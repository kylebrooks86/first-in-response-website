import json
import hashlib
import re
from pathlib import Path

root = Path("business-app-parity")

manifest = json.loads(
    (root / "release/G607_SESSION_MIGRATION_MANIFEST.json").read_text(encoding="utf-8")
)

reviewed = (
    root / "reviewed_independent_d1_sql_blobs.mjs"
).read_text(encoding="utf-8")

pins = dict(re.findall(
    r"name:'([^']+)',gitBlobSha1:'([a-f0-9]{40})'",
    reviewed
))

assert len(pins) == 26, "Historical pin count changed"

session_pin = "e02a210faa6f0c48c1880fe7236ed0ef708b99c1"

assert manifest["remoteMigrationAuthorized"] is False
assert manifest["deploymentAuthorized"] is False

targets = {
    "qa": 26,
    "independent-staging": 26,
    "independent-dr": 27,
    "independent-live": 27
}

assert set(manifest["environments"]) == set(targets)

for target, expected in targets.items():
    entry = manifest["environments"][target]
    migrations = entry["migrations"]

    files = {
        p.name: p
        for p in (root / "adapters/doomsday/drizzle").glob("*.sql")
    }

    for p in (root / "adapters" / target / "drizzle").glob("*.sql"):
        files[p.name] = p

    assert entry["migrationCount"] == expected
    assert len(files) == len(migrations) == expected

    for index, row in enumerate(migrations):
        name = row["name"]

        assert name == sorted(files)[index]
        assert row["id"] == index + 1
        assert int(name[:4]) == index

        data = files[name].read_bytes().replace(b"\r\n", b"\n")

        blob = hashlib.sha1(
            f"blob {len(data)}\0".encode() + data
        ).hexdigest()

        assert blob == row["gitBlobSha1"]
        assert hashlib.sha256(data).hexdigest() == row["sha256"]

        if index == expected - 1:
            assert name == f"{index:04d}_owner_auth_sessions.sql"
            assert blob == session_pin
        else:
            assert pins.get(name) == blob, (
                "Historical migration changed", target, name
            )

    print("PASS:", target, "- exact reviewed migration sequence")

print("G607 STRICT MIGRATION SOURCE VERIFICATION PASS")