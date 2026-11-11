"""Offline-only negative controls for the FIRE QA Cloudflare D1 Free-tier preflight."""
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "read_only_qa", Path(__file__).with_name("check_isolated_cloudflare_free_preflight.py")
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def db(index):
    return {"name": "synthetic-d1-" + str(index),
            "uuid": f"12345678-1234-4234-8234-{index:012d}"}


class NoCostReadOnlyProbe(unittest.TestCase):
    def test_capacity_under_ten_is_not_deployment_permission(self):
        for count in (0, 1, 8, 9):
            with self.subTest(count=count):
                result = m.inspect_d1_inventory([db(i) for i in range(count)])
                self.assertEqual(result["accountD1Count"], count)
                self.assertFalse(result["safeToDeploy"])
                self.assertFalse(result["actualZeroCostConfirmed"])
                self.assertFalse(result["cloudflareAccountPlanConfirmed"])
                self.assertFalse(result["qaWorkerNameAvailableConfirmed"])
                self.assertFalse(result["r2SubscriptionAndZeroCostConfirmed"])
                self.assertEqual(result["productionResourcesModified"], 0)

    def test_exhausted_free_plan_and_colliding_name_refused(self):
        for inventory in (
            [db(i) for i in range(10)],
            [{**db(1), "name": m.D1_NAME}],
            [{**db(1), "name": m.D1_NAME.upper()}, {**db(1), "name": m.D1_NAME}],
        ):
            with self.subTest(inventory=inventory), self.assertRaises(ValueError):
                m.inspect_d1_inventory(inventory)

    def test_ambiguous_and_unsupported_inventory_fails_closed(self):
        for inventory in (None, {}, "text", [None], [{"name": "missing-uuid"}],
                          [{"name": "nope", "uuid": "INVALID"}],
                          [db(1), db(1)],
                          [{**db(1), "name": "same-name"}, {**db(2), "name": "same-name"}],
                          [{**db(1), "uuid": db(2)["uuid"]}, db(2)]):
            with self.subTest(inventory=inventory), self.assertRaises(ValueError):
                m.inspect_d1_inventory(inventory)

    def test_read_only_wranger_invocation_and_private_output(self):
        raw = [{"name": "private-customer-db-name", "uuid": db(4)["uuid"]}]
        with patch.object(m.subprocess, "run", return_value=subprocess.CompletedProcess(
                args=[], returncode=0, stdout=json.dumps(raw), stderr="sensitive stderr")) as run:
            report = m.read_only_probe("wrangler.cmd")
        self.assertEqual(run.call_args.args[0], ["wrangler.cmd", "d1", "list", "--json"])
        self.assertEqual(report["accountD1Count"], 1)
        self.assertNotIn("private-customer-db-name", json.dumps(report))
        self.assertNotIn(db(4)["uuid"], json.dumps(report))
        self.assertFalse(report["safeToDeploy"])

    def test_cli_errors_do_not_echo_keys_or_secrets(self):
        with patch.object(m.subprocess, "run", return_value=subprocess.CompletedProcess(
                args=[], returncode=1, stdout="CF_API_KEY_secret", stderr="token_secret")):
            with self.assertRaises(ValueError) as e:
                m.read_only_probe("wrangler.cmd")
        self.assertNotIn("secret", str(e.exception))
        with patch.object(m.subprocess, "run", return_value=subprocess.CompletedProcess(
                args=[], returncode=0, stdout="secret bad JSON", stderr="")):
            with self.assertRaises(ValueError) as e:
                m.read_only_probe("wrangler.cmd")
        self.assertNotIn("secret", str(e.exception))

    def test_no_cloudflare_network_by_default(self):
        with patch.object(m.shutil, "which", side_effect=AssertionError("default must not inspect executables")), \
             patch.object(m.subprocess, "run", side_effect=AssertionError("default must not call CLI")):
            with patch("sys.argv", ["read-only-qa"]):
                self.assertEqual(m.main(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
