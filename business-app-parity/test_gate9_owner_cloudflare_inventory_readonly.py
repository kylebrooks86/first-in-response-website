"""Negative regression tests for one-read-only-call Gate 9 D1 inventory (synthetic only)."""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gate9_owner_cloudflare_inventory_readonly as gate


def db(name, value):
    return {"name": name, "uuid": value}


QA = db(gate.QA_NAME, gate.QA_ID)
DR = db(gate.DR_NAME, gate.DR_ID)


def fake(i):
    return db("synthetic-" + str(i), f"11111111-1111-4111-8111-{i:012d}")


class StrictGate9Inventory(unittest.TestCase):
    def test_good_historical_protection_is_only_a_count_preflight(self):
        r = gate.inventory_report([QA, DR])
        self.assertEqual(r["blockedReasons"], [])
        self.assertEqual(r["databaseCount"], 2)
        self.assertTrue(r["possibleOneNewD1UnderFreeCountLimit"])
        self.assertTrue(r["protectedQaD1MatchesHistoricalPin"])
        self.assertTrue(r["protectedDrD1MatchesHistoricalPin"])
        self.assertTrue(r["proposedNewDatabaseNameAvailable"])
        for name in ("safeToProvisionOrDeploy", "actualCloudflarePlanVerified",
                     "actualCloudflareBillingVerified", "newWorkerNameAvailableVerified",
                     "newWorkerAndDbPhysicallyIsolatedVerified", "stripeTestWebhookReady"):
            self.assertIs(r[name], False)
        self.assertEqual(r["remoteWrites"], 0)
        self.assertEqual(r["customerRowsRead"], 0)

    def test_missing_or_swapped_protected_resources_fails(self):
        cases = [
            ([DR], "PINNED_QA_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT"),
            ([QA], "PINNED_HISTORICAL_DR_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT"),
            ([db(gate.QA_NAME, "33333333-3333-4333-8333-333333333333"), DR],
             "PINNED_QA_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT"),
            ([QA, db(gate.DR_NAME, "33333333-3333-4333-8333-333333333333")],
             "PINNED_HISTORICAL_DR_D1_MISSING_OR_CHANGED_OR_WRONG_ACCOUNT"),
        ]
        for rows, code in cases:
            with self.subTest(code=code):
                self.assertIn(code, gate.inventory_report(rows)["blockedReasons"])

    def test_refuses_reusing_test_name_and_an_exhausted_free_count(self):
        rows = [QA, DR, db(gate.NEW_TEST_DB_NAME, fake(19)["uuid"])]
        r = gate.inventory_report(rows)
        self.assertIn("PROPOSED_NEW_TEST_D1_NAME_ALREADY_TAKEN", r["blockedReasons"])
        ten = [QA, DR] + [fake(i) for i in range(8)]
        r = gate.inventory_report(ten)
        self.assertEqual(r["databaseCount"], 10)
        self.assertIn("NO_FREE_TIER_D1_SLOT_IF_ACCOUNT_FREE", r["blockedReasons"])
        self.assertFalse(r["possibleOneNewD1UnderFreeCountLimit"])

    def test_malformed_and_duplicate_inventory_is_never_accepted(self):
        bad = [None, {}, "", [None], [{"name": "unsafe", "uuid": ""}],
               [db("noncanon", gate.QA_ID.upper())],
               [db("same", fake(0)["uuid"]), db("SAME", fake(1)["uuid"])],
               [QA, db("other", gate.QA_ID)],
               [QA, QA]]
        for entries in bad:
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                gate.inventory_report(entries)

    def test_one_readonly_wrangler_call_and_no_private_resource_output(self):
        payload = [QA, DR, fake(5)]
        with patch.object(gate.subprocess, "run", return_value=subprocess.CompletedProcess(
            args=[], returncode=0, stdout=json.dumps(payload),
            stderr="DO NOT EXPOSE TOKEN")) as invoke:
            result = gate.capture("wrangler.cmd")
        self.assertEqual(invoke.call_count, 1)
        self.assertEqual(invoke.call_args.args[0], ["wrangler.cmd", "d1", "list", "--json"])
        self.assertEqual(invoke.call_args.kwargs["timeout"], 60)
        output = json.dumps(result)
        self.assertNotIn(gate.QA_ID, output)
        self.assertNotIn(gate.DR_ID, output)
        self.assertNotIn("DO NOT EXPOSE TOKEN", output)
        self.assertNotIn(fake(5)["uuid"], output)

    def test_failed_or_corrupted_provider_output_stays_sanitized(self):
        for code, output in [(1, "secret token"), (0, "secret bad JSON")]:
            with patch.object(gate.subprocess, "run", return_value=subprocess.CompletedProcess(
                args=[], returncode=code, stdout=output, stderr="api-secret")):
                with self.assertRaises(ValueError) as cm:
                    gate.capture("wrangler.cmd")
                self.assertNotIn("secret", str(cm.exception).lower())
                self.assertNotIn("token", str(cm.exception).lower())

    def test_default_cli_requires_no_provider_or_shell(self):
        with patch.object(gate.shutil, "which", side_effect=AssertionError("no cli lookup")), \
             patch.object(gate.subprocess, "run", side_effect=AssertionError("no network")), \
             patch("sys.argv", ["gate9_owner_cloudflare_inventory_readonly.py"]):
            self.assertEqual(gate.main(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
