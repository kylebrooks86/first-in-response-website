import copy
import json
from pathlib import Path
import tempfile
import unittest

from candidate_release_manifest import build_manifest, verify_manifest


class CandidateManifest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "shared/app").mkdir(parents=True)
        (self.root / "shared/app/dashboard.tsx").write_text("shared candidate")
        for target in ["live", "doomsday", "staging"]:
            directory = self.root / "adapters" / target
            (directory / "drizzle").mkdir(parents=True)
            (directory / "drizzle/0000_fixture.sql").write_text("CREATE TABLE fixture(id TEXT);")
            (directory / "ABSENT_FILES.json").write_text("[]")
        (self.root / "PROGRESS_STATUS.json").write_text(json.dumps({"productionReadiness": {"gatesPassed": 3, "totalGates": 10, "percent": 30, "pending": ["remote checks"]}}))
        for name in ["CANDIDATE_COMMITS.json", "FIRE_DEPLOYMENT_INVENTORY.json"]:
            (self.root / name).write_text("{}")

    def tearDown(self):
        self.temp.cleanup()

    def manifest(self):
        return build_manifest(self.root, "a" * 40)

    def test_deterministic_and_never_authorizes_publication(self):
        first = self.manifest()
        self.assertEqual(first, self.manifest())
        self.assertTrue(verify_manifest(self.root, first))
        self.assertEqual(first["overallVerifiedReadiness"]["percent"], 30)
        self.assertFalse(first["publicationAuthorized"])
        self.assertFalse(first["productionReady"])
        forged = copy.deepcopy(first)
        forged["publicationAuthorized"] = True
        with self.assertRaises(ValueError):
            verify_manifest(self.root, forged)

    def test_source_and_migration_drift_rejected(self):
        sealed = self.manifest()
        source = self.root / "shared/app/dashboard.tsx"
        source.write_text("changed")
        with self.assertRaises(ValueError):
            verify_manifest(self.root, sealed)
        source.write_text("shared candidate")
        (self.root / "adapters/doomsday/drizzle/0000_fixture.sql").write_text("different migration")
        with self.assertRaises(ValueError):
            verify_manifest(self.root, sealed)

    def test_migration_gap_and_unsafe_absence_rejected(self):
        directory = self.root / "adapters/doomsday"
        (directory / "drizzle/0002_gap.sql").write_text("SELECT 1;")
        with self.assertRaisesRegex(ValueError, "sequence"):
            self.manifest()
        (directory / "drizzle/0002_gap.sql").unlink()
        (directory / "ABSENT_FILES.json").write_text('["../outside"]')
        with self.assertRaisesRegex(ValueError, "absence"):
            self.manifest()

    def test_symlink_and_inconsistent_progress_rejected(self):
        link = self.root / "shared/app/link"
        link.symlink_to(self.root / "shared/app/dashboard.tsx")
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.manifest()
        link.unlink()
        p = self.root / "PROGRESS_STATUS.json"
        data = json.loads(p.read_text())
        data["productionReadiness"]["percent"] = 90
        p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "percentage"):
            self.manifest()

    def test_unapproved_shared_application_override_rejected(self):
        directory = self.root / "adapters/doomsday/app"
        directory.mkdir()
        (directory / "dashboard.tsx").write_text("drifted dashboard")
        with self.assertRaisesRegex(ValueError, "differs"):
            self.manifest()


if __name__ == "__main__":
    unittest.main()
