"""Synthetic negative-control tests for three-version first-use database parity."""
from __future__ import annotations
from pathlib import Path
import tempfile
import unittest
from verify_three_candidate_schema_parity import (
    TARGETS, SchemaParityError, compare, migration_paths, schema,
)

TABLES = ("customers", "customer_photos", "estimates", "invoices", "payments",
          "payment_refunds", "deposit_policy_events", "deposit_agreement_snapshots")
BASE = "\n".join(f"CREATE TABLE {name} (id TEXT PRIMARY KEY);" for name in TABLES)
INDEX = "CREATE UNIQUE INDEX idx_customer_test ON customers(id);"
TRIGGER = ("CREATE TRIGGER customer_no_update BEFORE UPDATE ON customers "
           "BEGIN SELECT RAISE(ABORT, 'immutable'); END;")
class FreshInstallationParity(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="fire-schema-parity-")
        self.addCleanup(temp.cleanup)
        self.roots = {}
        for target in TARGETS:
            root = Path(temp.name, target)
            (root / "drizzle").mkdir(parents=True)
            (root / "drizzle" / "0000_base.sql").write_text(BASE + "\n" + INDEX + "\n" + TRIGGER)
            self.roots[target] = root
    def put(self, target, name, value):
        (self.roots[target] / "drizzle" / name).write_text(value)
    def test_equal_final_schemas_allow_distinct_migration_histories(self):
        self.put("doomsday", "0001_extra_safe_noop.sql", "SELECT 1;")
        proof = compare(self.roots)
        self.assertTrue(proof["schemaEquivalent"], proof)
        self.assertEqual(proof["targetMetadata"]["live"]["migrationCount"], 1)
        self.assertEqual(proof["targetMetadata"]["doomsday"]["migrationCount"], 2)
        self.assertFalse(proof["migrationHistoryMustMatch"])
        self.assertFalse(proof["hostedDatabasesRead"])
        self.assertFalse(proof["productionReady"])
    def test_missing_shared_business_table_is_rejected(self):
        p = self.roots["staging"] / "drizzle" / "0000_base.sql"
        p.write_text(BASE.replace("CREATE TABLE customer_photos (id TEXT PRIMARY KEY);", "") + INDEX + TRIGGER)
        with self.assertRaisesRegex(SchemaParityError, "Required full-app release table missing"):
            compare(self.roots)
    def test_constraint_and_trigger_mutation_detected(self):
        p = self.roots["doomsday"] / "drizzle" / "0000_base.sql"
        p.write_text(BASE.replace("payments (id TEXT PRIMARY KEY)", "payments (id TEXT PRIMARY KEY CHECK(length(id)>4))")
                     + "\n" + INDEX + "\n" + TRIGGER.replace("UPDATE ON", "DELETE ON"))
        proof = compare(self.roots)
        self.assertFalse(proof["schemaEquivalent"])
        self.assertTrue({"payments", "customer_no_update"}.issubset(
            {row["object"] for row in proof["mismatches"]}))
    def test_missing_index_is_drift(self):
        p = self.roots["staging"] / "drizzle" / "0000_base.sql"
        p.write_text(BASE + "\n" + TRIGGER)
        proof = compare(self.roots)
        self.assertFalse(proof["schemaEquivalent"])
        self.assertIn("idx_customer_test", {row["object"] for row in proof["mismatches"]})
    def test_exact_nullable_provider_partial_unique_is_equivalent_but_only_that(self):
        full = ("CREATE UNIQUE INDEX `idx_payment_refunds_provider` "
                "ON `payment_refunds` (`provider_refund_id`);")
        partial = ("CREATE UNIQUE INDEX `idx_payment_refunds_provider` "
                   "ON `payment_refunds` (`provider_refund_id`) "
                   "WHERE `provider_refund_id` IS NOT NULL;")
        # The actual nullable provider column is needed for both index forms.
        for target in TARGETS:
            base = self.roots[target] / "drizzle" / "0000_base.sql"
            data = base.read_text().replace(
                "payment_refunds (id TEXT PRIMARY KEY)",
                "payment_refunds (id TEXT PRIMARY KEY, provider_refund_id TEXT)")
            base.write_text(data + "\n" + (partial if target == "doomsday" else full))
        proof = compare(self.roots)
        self.assertTrue(proof["schemaEquivalent"], proof)
        self.assertEqual(len(proof["semanticallyEquivalentIndexVariations"]), 1)
        # Any OTHER predicate is not an allowed or logically equivalent waiver.
        doomsday = self.roots["doomsday"] / "drizzle" / "0000_base.sql"
        doomsday.write_text(doomsday.read_text().replace(
            "WHERE `provider_refund_id` IS NOT NULL",
            "WHERE `provider_refund_id` LIKE 're_%'"))
        proof = compare(self.roots)
        self.assertFalse(proof["schemaEquivalent"])
        self.assertIn("idx_payment_refunds_provider",
                      {row["object"] for row in proof["mismatches"]})

    def test_new_app_migrations_cannot_seed_customers(self):
        self.put("live", "0001_bad_seed.sql", "INSERT INTO customers(id) VALUES('synthetic-but-unwanted');")
        with self.assertRaisesRegex(SchemaParityError, "unexpectedly seeds"):
            compare(self.roots)
    def test_noncontiguous_extra_sql_and_symlinks_refused(self):
        self.put("doomsday", "0002_skips_one.sql", "SELECT 1;")
        with self.assertRaisesRegex(SchemaParityError, "contiguous"):
            migration_paths(self.roots["doomsday"])
        (self.roots["doomsday"] / "drizzle" / "0002_skips_one.sql").unlink()
        self.put("doomsday", "extra.sql", "SELECT 1;")
        with self.assertRaisesRegex(SchemaParityError, "Unexpected SQL migration"):
            migration_paths(self.roots["doomsday"])
        (self.roots["doomsday"] / "drizzle" / "extra.sql").unlink()
        linked = self.roots["doomsday"] / "drizzle" / "0001_link.sql"
        try:
            linked.symlink_to(self.roots["live"] / "drizzle" / "0000_base.sql")
        except (OSError, NotImplementedError):
            self.skipTest("Fixture filesystem disallows symlinks")
        with self.assertRaisesRegex(SchemaParityError, "symlink"):
            migration_paths(self.roots["doomsday"])
    def test_integrity_discloses_no_remote_state(self):
        schema_data, meta = schema(self.roots["live"])
        self.assertGreater(meta["objectCount"], 0)
        self.assertEqual(meta["initialBusinessRows"], 0)
        self.assertNotIn("d1_migrations", schema_data)

if __name__ == "__main__":
    unittest.main(verbosity=2)
