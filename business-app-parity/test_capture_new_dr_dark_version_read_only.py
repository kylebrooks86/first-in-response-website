"""Offline-only fail-closed tests for the NEW dark DR hosted identity checker.

All responses are synthetic. Never invokes Cloudflare, real npx or D1 SQL.
Existing accepted DR D1 26/26 evidence is NOT rerun.
"""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import capture_new_dr_dark_version_read_only as m


def status(version=m.VERSION, share=100):
    return {"versions": [{"version_id": version, "percentage": share}]}


def details(version=m.VERSION, db=m.DR_UUID):
    return {
        "id": version,
        "resources": {"bindings": [
            {"name": "DB", "type": "d1_database", "id": db},
            *[{"name": name, "type": "plain_text", "text": text}
              for name, text in m.EXPECTED_TEXT.items()],
        ]},
    }


def inventory():
    return [
        {"name": m.DR_DB, "uuid": m.DR_UUID},
        {"name": "fire-app-staging-db", "uuid": "afb2c05a-d794-4a9a-b580-924ce01c26ad"},
        {"name": "fire-fullapp-new-live-db", "uuid": "0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662"},
    ]


class DarkNewDrIdentity(unittest.TestCase):
    def test_exact_owner_version_and_full_deployment_required(self):
        self.assertEqual(m.current_version(status()), m.VERSION)
        for value in (
            {}, None, {"versions": []}, {"versions": [status()["versions"][0]] * 2},
            status(share=90), status(share="100"),
            status(version="00000000-0000-4000-8000-000000000000"),
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                m.current_version(value)

    def test_exact_provider_version_binding_and_all_four_dark_vars(self):
        self.assertTrue(m.actual_binding_contract(details()))
        alternative = details()
        alternative["bindings"] = alternative.pop("resources")["bindings"]
        self.assertTrue(m.actual_binding_contract(alternative))
        for alter in (
            lambda x: x["resources"]["bindings"].append({"name": "SECRET", "type": "secret_text"}),
            lambda x: x["resources"]["bindings"][0].update({"id": "00000000-0000-4000-8000-000000000000"}),
            lambda x: x["resources"]["bindings"][0].update({"type": "r2_bucket"}),
            lambda x: x["resources"]["bindings"][1].update({"text": "production"}),
            lambda x: x["resources"]["bindings"][2].update({"text": "owner-approved"}),
            lambda x: x["resources"]["bindings"][3].update({"text": "r2"}),
            lambda x: x["resources"]["bindings"][4].update({"text": "https://evil.example"}),
            lambda x: x.update({"id": "00000000-0000-4000-8000-000000000000"}),
            lambda x: x.pop("resources"),
        ):
            bad = details()
            alter(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                m.actual_binding_contract(bad)
        duplicate = details()
        duplicate["resources"]["bindings"][4]["name"] = "DB"
        self.assertRaises(ValueError, m.actual_binding_contract, duplicate)
        ambiguous = details()
        ambiguous["bindings"] = details()["resources"]["bindings"]
        self.assertRaises(ValueError, m.actual_binding_contract, ambiguous)

    def test_exact_independent_d1_inventory_and_cross_target_refusal(self):
        self.assertTrue(m.inventory_matches(inventory()))
        for bad in (
            None, [], inventory() * 2,
            [{"name": m.DR_DB, "uuid": "00000000-0000-4000-8000-000000000000"}],
            [{"name": "different-name", "uuid": m.DR_UUID}],
        ):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                m.inventory_matches(bad)

    def test_only_three_allowlisted_reads_and_sanitized_result(self):
        seen = []
        values = [status(), details(), inventory()]
        def fake(npx, args):
            self.assertEqual(npx, "FAKE_NPX")
            seen.append(tuple(args))
            return values[len(seen) - 1]
        result = m.capture("FAKE_NPX", fake)
        self.assertEqual(tuple(seen), m.SAFE_COMMANDS)
        self.assertEqual(result["ownerObservedVersionIdMatched"], m.VERSION)
        self.assertEqual(result["versionBindingsMatchedActualD1"], m.DR_UUID)
        self.assertFalse(result["hostedRoutesProviderVerified"])
        self.assertFalse(result["accessPolicyProviderVerified"])
        self.assertFalse(result["hostedSourceShaVerified"])
        self.assertFalse(result["gate4Accepted"])
        self.assertFalse(result["productionReady"])
        self.assertEqual(result["acceptedReleaseGates"], 4)
        self.assertNotIn("privateKey", str(result))
        self.assertNotIn("customerRows", str(result))

    def test_fail_fast_never_uses_inventory_to_rescue_wrong_version_or_db(self):
        for cases, expected in (
            ([status(share=20)], 1),
            ([status(), details(db="00000000-0000-4000-8000-000000000000")], 2),
            ([status(), details(), []], 3),
        ):
            seen = []
            def fake(_npx, args):
                seen.append(args)
                return cases[len(seen)-1]
            with self.subTest(cases=cases), self.assertRaises(ValueError):
                m.capture("FAKE_NPX", fake)
            self.assertEqual(len(seen), expected)

    def test_provider_stderr_and_response_are_never_exposed(self):
        from subprocess import CompletedProcess
        with patch.object(m.subprocess, "run", return_value=CompletedProcess(
            args=[], returncode=1, stdout="PRIVATE_RECORD", stderr="CLOUDFLARE_TOKEN_ABC")):
            with self.assertRaises(ValueError) as error:
                m.read_only_cli("FAKE_NPX", list(m.SAFE_COMMANDS[0]))
        self.assertNotIn("PRIVATE_RECORD", str(error.exception))
        self.assertNotIn("CLOUDFLARE_TOKEN", str(error.exception))
        with self.assertRaises(ValueError):
            m.read_only_cli("FAKE_NPX", ["deploy", "--name", m.WORKER])
        with self.assertRaises(ValueError):
            m.read_only_cli("FAKE_NPX", ["d1", "execute", m.DR_DB])

    @unittest.skipUnless(sys.platform == "win32", "Windows-only fake npx.cmd subprocess regression")
    def test_windows_npx_cmd_args_and_exit_code_are_captured_without_provider(self):
        """Use a temp mock .cmd; NEVER call real Wrangler or a network endpoint."""
        with tempfile.TemporaryDirectory(prefix="fire-dr-npx-offline-") as folder:
            cmd = Path(folder) / "npx.cmd"
            cmd.write_text(
                '@echo off\n'
                'if not "%~1"=="--yes" exit /b 77\n'
                'if not "%~2"=="wrangler@4.162.0" exit /b 78\n'
                'if not "%~3"=="deployments" exit /b 79\n'
                'echo {"versions":[{"version_id":"'+m.VERSION+'","percentage":100}]}\n',
                encoding="ascii",
            )
            result = m.read_only_cli(str(cmd), list(m.SAFE_COMMANDS[0]))
            self.assertEqual(m.current_version(result), m.VERSION)
            with self.assertRaises(ValueError):
                m.read_only_cli(str(cmd), list(m.SAFE_COMMANDS[2]))

    def test_default_main_does_not_contact_cloudflare(self):
        with patch("sys.argv", ["script"]), patch.object(m.shutil, "which",
             side_effect=AssertionError("Dry mode must not look up executable")):
            self.assertEqual(m.main(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
