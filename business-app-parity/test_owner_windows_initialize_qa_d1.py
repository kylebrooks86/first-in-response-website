"""Static fail-closed safety checks for the QA-only Windows D1 initializer.

No network and no Cloudflare credentials involved. Never invokes -Apply.
"""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
SCRIPT = (ROOT / "owner_windows_initialize_qa_d1.ps1").read_text(encoding="utf-8")
CONFIG = json.loads((ROOT / "wrangler.qa-migrations.json").read_text(encoding="utf-8"))
MIGRATIONS = sorted((ROOT / "adapters/doomsday/drizzle").glob("*.sql"))
QA_UUID = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
STAGING_UUID = "afb2c05a-d794-4a9a-b580-924ce01c26ad"


class IsolatedQAMigrationGuard(unittest.TestCase):
    def test_migration_config_is_only_new_qa_d1(self):
        self.assertEqual(CONFIG["name"], "fire-fullapp-qa-20261016")
        self.assertEqual(len(CONFIG["d1_databases"]), 1)
        self.assertEqual(CONFIG["d1_databases"][0], {
            "binding": "DB",
            "database_name": "fire-fullapp-qa-db-20261016",
            "database_id": QA_UUID,
            "migrations_dir": "adapters/doomsday/drizzle",
            "migrations_table": "d1_migrations"
        })
        self.assertTrue(set(CONFIG) <= {"name", "compatibility_date", "d1_databases"})
        self.assertNotIn(STAGING_UUID, json.dumps(CONFIG))
        self.assertNotIn("fire-app-staging-db", json.dumps(CONFIG))
        self.assertEqual(len(MIGRATIONS), 23)
        self.assertEqual([int(file.name[:4]) for file in MIGRATIONS], list(range(23)))
        self.assertEqual(MIGRATIONS[-1].name, "0022_stripe_provider_uniqueness.sql")

    def test_no_write_without_owner_explicit_apply_and_full_uuid(self):
        self.assertIn("param([switch]$Apply)", SCRIPT)
        self.assertIn("if (-not $Apply)", SCRIPT)
        self.assertIn("DRY RUN PASS", SCRIPT)
        self.assertIn("Read-Host", SCRIPT)
        self.assertIn("INITIALIZE QA ' + $uuid", SCRIPT)
        apply_command = "& $wrangler.Source d1 migrations apply $name --remote"
        self.assertEqual(SCRIPT.count(apply_command), 1)
        self.assertLess(SCRIPT.index("if (-not $Apply)"), SCRIPT.index("Read-Host"))
        self.assertLess(SCRIPT.index("Read-Host"), SCRIPT.index(apply_command))
        self.assertIn("Assert-True ($choice -ceq $expected)", SCRIPT)
        self.assertLess(SCRIPT.index("Assert-True ($choice -ceq $expected)"),
                        SCRIPT.index(apply_command))
        self.assertIn("Assert-True ($info.uuid -ceq $uuid", SCRIPT)
        self.assertIn("$null -ne $info.PSObject.Properties['num_tables']", SCRIPT)

    def test_account_identity_and_exact_migration_order_are_checked_first(self):
        self.assertIn("d1 list --json", SCRIPT)
        self.assertIn("d1 info $name --json", SCRIPT)
        self.assertIn("$_.name -ceq $name -and $_.uuid -ceq $uuid", SCRIPT)
        self.assertIn("$_.name -ceq $oldName -and $_.uuid -ceq $oldUuid", SCRIPT)
        self.assertIn("8ccfb1f8-1657-4074-b1b2-47de78f95003", SCRIPT)
        self.assertIn(STAGING_UUID, SCRIPT)  # read-only identity comparison only
        self.assertIn("Expected exactly 23 QA schema migrations", SCRIPT)
        self.assertIn("Migration file/order mismatch", SCRIPT)
        self.assertIn("0022_stripe_provider_uniqueness.sql", SCRIPT)
        self.assertLess(SCRIPT.index("d1 list --json"),
                        SCRIPT.index("d1 info $name --json"))
        self.assertLess(SCRIPT.index("d1 info $name --json"),
                        SCRIPT.index("if (-not $Apply)"))

    def test_no_other_remote_mutations_or_downloads(self):
        for unsafe in [
            "d1 execute", "d1 export", "d1 create",
            "wrangler deploy", "wrangler publish",
            "r2 bucket", "secret put", "time-travel restore",
            "migrations apply $oldName",
            "Invoke-WebRequest", "Invoke-RestMethod",
            "Start-Process", "Invoke-Expression",
            "curl ", "npm ", "npx ", "git ",
        ]:
            with self.subTest(unsafe=unsafe):
                self.assertNotIn(unsafe, SCRIPT)
        self.assertNotIn("Set-ExecutionPolicy", SCRIPT)
        self.assertNotIn("skip-confirmation", SCRIPT)
        self.assertEqual(SCRIPT.count("--remote"), 1)
        self.assertNotIn("--preview", SCRIPT)
        self.assertIn("Push-Location $PSScriptRoot", SCRIPT)
        self.assertIn("finally { Pop-Location }", SCRIPT)


if __name__ == "__main__":
    unittest.main(verbosity=2)
