import json
from pathlib import Path
import tempfile
import unittest

from prepare_local_doomsday import ROOT, LOCAL_DATABASE_ID, digest, prepare, verify_build


class LocalDoomsdayPreparation(unittest.TestCase):
    def test_candidate_preserves_source_auth_and_migrations(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "candidate"
            manifest = prepare(output)
            for relative in ["app/dashboard.tsx", "app/api/weather/route.ts"]:
                self.assertEqual(digest(output / relative), digest(ROOT / "shared" / relative))
            self.assertEqual(digest(output / "app/owner-auth.ts"), digest(ROOT / "adapters/doomsday/app/owner-auth.ts"))
            source_migrations = ROOT / "adapters/doomsday/drizzle"
            for path in source_migrations.rglob("*"):
                if path.is_file():
                    self.assertEqual(digest(output / "drizzle" / path.relative_to(source_migrations)), digest(path))
            self.assertFalse((output / "app/api/staging-fixtures/route.ts").exists())
            self.assertEqual(json.loads((output / "LOCAL_DOOMSDAY_BUILD.json").read_text()), manifest)
            config = (output / "vite.config.ts").read_text()
            self.assertIn(LOCAL_DATABASE_ID, config)
            self.assertIn('name: "fire-doomsday-local"', config)
            self.assertNotIn("r2_buckets", config)
            self.assertNotIn("afb2c05a-d794-4a9a-b580-924ce01c26ad", config)
            self.assertFalse(manifest["productionReady"])
            self.assertFalse(manifest["secretsConfigured"])

    def test_existing_directory_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            sentinel = Path(temp) / "keep"
            sentinel.write_text("existing candidate")
            with self.assertRaisesRegex(ValueError, "existing destination"):
                prepare(Path(temp))
            self.assertEqual(sentinel.read_text(), "existing candidate")

    def test_dangling_destination_symlink_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "link"
            output.symlink_to(Path(temp) / "missing")
            with self.assertRaises(ValueError):
                prepare(output)
            self.assertTrue(output.is_symlink())

    def test_invalid_dependencies_do_not_create_candidate(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "candidate"
            with self.assertRaisesRegex(ValueError, "Dependencies"):
                prepare(output, Path(temp))
            self.assertFalse(output.exists())

    def test_generated_build_guard(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "candidate"
            prepare(output)
            config_path = output / "dist/server/wrangler.json"
            config_path.parent.mkdir(parents=True)
            config = {"name": "fire-doomsday-local", "d1_databases": [{"binding": "DB", "database_name": "fire-doomsday-local", "database_id": LOCAL_DATABASE_ID}]}
            config_path.write_text(json.dumps(config))
            self.assertTrue(verify_build(output)["localBuildVerified"])
            config["d1_databases"][0]["database_id"] = "real-resource-must-be-rejected"
            config_path.write_text(json.dumps(config))
            with self.assertRaisesRegex(ValueError, "identity"):
                verify_build(output)
            config["d1_databases"][0]["database_id"] = LOCAL_DATABASE_ID
            for key in ["r2_buckets", "vars", "services", "kv_namespaces", "routes"]:
                config_path.write_text(json.dumps({**config, key: ["unexpected"]}))
                with self.assertRaisesRegex(ValueError, "resources"):
                    verify_build(output)
            config_path.write_text(json.dumps(config))
            (output / "app/dashboard.tsx").write_text("unexpected source")
            with self.assertRaisesRegex(ValueError, "source changed"):
                verify_build(output)


if __name__ == "__main__":
    unittest.main()
