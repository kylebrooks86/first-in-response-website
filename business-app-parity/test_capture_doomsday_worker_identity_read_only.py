"""No-network negative controls for owner-only active Worker/D1 binding check."""
import copy
import unittest
from unittest.mock import patch
import capture_doomsday_worker_identity_read_only as m


VID = "11111111-2222-4333-8444-555555555555"


def status(version=VID, percent=100):
    return {"versions": [{"version_id": version, "percentage": percent}]}


def detail(version=VID, database=m.DB_UUID):
    return {"id": version, "bindings": [
        {"name": "DB", "type": "d1", "id": database},
        {"name": "SAFE_OTHER", "type": "plain_text", "text": "DO_NOT_LEAK"},
    ]}


def inventory():
    return [{"name": m.DATABASE, "uuid": m.DB_UUID}]


class ReadOnlyWorkerIdentity(unittest.TestCase):
    def test_active_version_exact_single_full_traffic(self):
        self.assertEqual(m.active_version(status()), VID)
        self.assertRaisesRegex(ValueError, "100%", m.active_version, status(percent=80))
        for bad in (None, {}, {"versions": []},
                    {"versions": [status()["versions"][0]] * 2},
                    {"versions": [{"version_id": VID, "percentage": "100"}]},
                    status(version="not-a-uuid")):
            with self.subTest(value=bad), self.assertRaises(ValueError):
                m.active_version(bad)

    def test_version_identity_rejects_wrong_target(self):
        self.assertTrue(m.version_database_binding(detail(), VID))
        self.assertTrue(m.version_database_binding(
            {"id": VID, "resources": {"bindings": detail()["bindings"]}}, VID))
        for changed in ("00000000-0000-4000-8000-000000000000", "wrong"):
            with self.subTest(value=changed), self.assertRaises(ValueError):
                m.version_database_binding(detail(database=changed), VID)
        self.assertRaisesRegex(ValueError, "disagree", m.version_database_binding,
                               detail(version=m.OLD_VERSION), VID)

    def test_refuses_ambiguous_or_untyped_bindings(self):
        for bad in (
            {"id": VID},
            {"id": VID, "bindings": []},
            {"id": VID, "bindings": [detail()["bindings"][0]] * 2},
            {"id": VID, "bindings": [{"name": "DB", "type": "plain_text", "id": m.DB_UUID}]},
            {"id": VID, "bindings": [{"name": "DATABASE", "type": "d1", "id": m.DB_UUID}]},
            {"id": VID, "bindings": detail()["bindings"], "resources": {"bindings": []}},
        ):
            with self.subTest(value=bad), self.assertRaises(ValueError):
                m.version_database_binding(bad, VID)

    def test_d1_inventory_exact_name_uuid_required(self):
        self.assertTrue(m.inventory_check(inventory()))
        for bad in (None, [], [{"name": m.DATABASE, "uuid": VID}],
                    inventory() * 2, [{"name": "lookalike", "uuid": m.DB_UUID}]):
            with self.subTest(value=bad), self.assertRaises(ValueError):
                m.inventory_check(bad)

    def test_end_to_end_allowlisted_read_commands_and_sanitized_receipt(self):
        used = []
        values = [status(), detail(), inventory()]
        def runner(executable, args):
            self.assertEqual(executable, "FAKE_CLI")
            used.append(args)
            return values[len(used) - 1]
        report = m.read_only_check("FAKE_CLI", runner=runner)
        self.assertEqual(used, [
            ["deployments", "status", "--name", m.WORKER, "--json"],
            ["versions", "view", VID, "--name", m.WORKER, "--json"],
            ["d1", "list", "--json"],
        ])
        self.assertEqual(report["databaseUuid"], m.DB_UUID)
        self.assertFalse(report["gate4Passed"])
        self.assertFalse(report["gate5Passed"])
        self.assertFalse(report["liveAndRefundStagingVerified"])
        self.assertFalse(report["artifactSourceShaVerified"])
        self.assertEqual(report["officialReadinessPercent"], 30)
        self.assertNotIn("DO_NOT_LEAK", str(report))

    def test_failed_version_validation_does_not_fall_back_to_inventory(self):
        used = []
        def runner(_cli, args):
            used.append(args)
            return status(percent=40)
        with self.assertRaisesRegex(ValueError, "100%"):
            m.read_only_check("FAKE_CLI", runner=runner)
        self.assertEqual(len(used), 1)

    def test_wrong_binding_does_not_fall_back_to_d1_database_name(self):
        used = []
        def runner(_cli, args):
            used.append(args)
            return [status(), detail(database=VID)][len(used)-1]
        with self.assertRaisesRegex(ValueError, "pinned"):
            m.read_only_check("FAKE_CLI", runner=runner)
        self.assertEqual(len(used), 2)

    def test_known_old_worker_version_does_not_prove_current_binding(self):
        used = []
        def runner(_cli, args):
            used.append(args)
            return [status(m.OLD_VERSION), detail(version=m.OLD_VERSION), inventory()][len(used)-1]
        report = m.read_only_check("FAKE_CLI", runner=runner)
        self.assertFalse(report["historicalObservedVersionChanged"])
        self.assertFalse(report["artifactSourceShaVerified"])

    def test_cli_errors_never_echo_secrets(self):
        from subprocess import CompletedProcess
        with patch.object(m.subprocess, "run", return_value=CompletedProcess(
                args=[], returncode=1, stdout="secret-token", stderr="API_KEY_private")):
            with self.assertRaises(ValueError) as err:
                m.parse_command("fake", ["deployments", "status"])
        self.assertNotIn("secret-token", str(err.exception))
        self.assertNotIn("API_KEY_private", str(err.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
