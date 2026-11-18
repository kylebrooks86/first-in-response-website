"""Offline QA backup guard tests: current active version, no automatic export.

No Cloudflare credentials, customer data, private files, or provider operations.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
ACTIVE = "08d77fb1-9484-4014-bd5b-1bb1da066cdb"
OBSOLETE = ("99fa8c27-df83-48d3-b953-9a84eb295334",
            "6d77bd7c-20d3-49aa-9816-c651d98953cb")


def extract(source, variable):
    matches = re.findall(
        r"^\$" + re.escape(variable) + r"\s*=\s*'([^']+)'\s*$",
        source, flags=re.M)
    if len(matches) != 1:
        raise ValueError("A single unambiguous executable version pin is required")
    return matches[0]


class Current25PrivateBackupPinTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wrapper = (ROOT / "owner_windows_qa_backup_current25.ps1").read_text(encoding="utf-8")
        cls.review = (ROOT / "owner_windows_qa_current_readonly.ps1").read_text(encoding="utf-8")
        cls.verifier = (ROOT / "verify_qa_current25_d1_export.py").read_text(encoding="utf-8")

    def test_current_backup_review_and_receipt_agree_exactly(self):
        self.assertEqual(extract(self.wrapper, "version"), ACTIVE)
        self.assertEqual(extract(self.review, "expectedVersion"), ACTIVE)
        self.assertIn('LAST_QA_WORKER_VERSION = "' + ACTIVE + '"', self.verifier)
        for stale in OBSOLETE:
            self.assertNotIn(stale, self.wrapper)
            self.assertNotIn(stale, self.review)
            self.assertNotIn(stale, self.verifier)

    def test_preflight_checks_actual_executable_pin_not_comment(self):
        self.assertIn("[regex]::Matches($reviewText", self.wrapper)
        self.assertIn(
            r"""$reviewPins=[regex]::Matches($reviewText, '(?m)^\$expectedVersion\s*=\s*''([^'']+)''[ \t]*(?:\r?\n|\z)')""",
            self.wrapper,
            "PowerShell pin regex must be a non-interpolating literal"
        )
        self.assertIn("$reviewPins.Count -eq 1", self.wrapper)
        self.assertIn("$reviewPins[0].Groups[1].Value -ceq $version", self.wrapper)
        # If the correct pin appears in prose but the executable pin is stale,
        # the expected exact-pin contract must reject it.
        forged = self.review.replace(
            "$expectedVersion = '" + ACTIVE + "'",
            "$expectedVersion = '" + OBSOLETE[0] + "'"
        ) + "\n# Previously active version was " + ACTIVE
        self.assertNotEqual(extract(forged, "expectedVersion"), ACTIVE)
        duplicate = self.review + "\n$expectedVersion = '" + ACTIVE + "'\n"
        with self.assertRaises(ValueError):
            extract(duplicate, "expectedVersion")

    def test_default_returns_before_provider_and_private_file_operations(self):
        script = self.wrapper
        guard = script.index("if (-not $Export) {")
        safe_return = script.index("\n    return\n}", guard)
        self.assertLess(safe_return, script.index("Get-Command 'wrangler.cmd'"))
        self.assertLess(safe_return, script.index("Read-Host"))
        self.assertLess(safe_return, script.index("d1 export $database --remote"))
        self.assertIn("EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO", script)
        self.assertIn("Require ($typed -ceq ('EXPORT '+$qaUuid))", script)
        self.assertIn("Require ($custody -ceq 'PRIVATE CURRENT25')", script)
        self.assertIn("No deploy, hosted SQL writes", script)
        self.assertIn("$reviewPins[0].Groups[1].Value -ceq $version", script)
        self.assertIn("OFFLINE_CURRENT_QA_25_RESTORE_PASSED", script)
        self.assertNotIn("d1 migrations apply", script)
        self.assertNotIn("r2 bucket create", script)

    def test_exact_historical_gate_count_not_misreported(self):
        self.assertIn("FORMAL_GATES_ACCEPTED=4/10", self.wrapper)
        self.assertIn('"officialGatesPassed": 4', self.verifier)
        self.assertNotIn('"officialGatesPassed": 3', self.verifier)


if __name__ == "__main__":
    unittest.main()
)""",
            self.wrapper,
            "Regex must be a PowerShell single-quoted literal: double quotes interpolate $expectedVersion"
        )
        self.assertIn("$reviewPins.Count -eq 1", self.wrapper)
        self.assertIn("$reviewPins[0].Groups[1].Value -ceq $version", self.wrapper)
        # If the correct pin appears in prose but the executable pin is stale,
        # the expected exact-pin contract must reject it.
        forged = self.review.replace(
            "$expectedVersion = '" + ACTIVE + "'",
            "$expectedVersion = '" + OBSOLETE[0] + "'"
        ) + "\n# Previously active version was " + ACTIVE
        self.assertNotEqual(extract(forged, "expectedVersion"), ACTIVE)
        duplicate = self.review + "\n$expectedVersion = '" + ACTIVE + "'\n"
        with self.assertRaises(ValueError):
            extract(duplicate, "expectedVersion")

    def test_default_returns_before_provider_and_private_file_operations(self):
        script = self.wrapper
        guard = script.index("if (-not $Export) {")
        safe_return = script.index("\n    return\n}", guard)
        self.assertLess(safe_return, script.index("Get-Command 'wrangler.cmd'"))
        self.assertLess(safe_return, script.index("Read-Host"))
        self.assertLess(safe_return, script.index("d1 export $database --remote"))
        self.assertIn("EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO", script)
        self.assertIn("Require ($typed -ceq ('EXPORT '+$qaUuid))", script)
        self.assertIn("Require ($custody -ceq 'PRIVATE CURRENT25')", script)
        self.assertIn("No deploy, hosted SQL writes", script)
        self.assertIn("$reviewPins[0].Groups[1].Value -ceq $version", script)
        self.assertIn("OFFLINE_CURRENT_QA_25_RESTORE_PASSED", script)
        self.assertNotIn("d1 migrations apply", script)
        self.assertNotIn("r2 bucket create", script)

    def test_exact_historical_gate_count_not_misreported(self):
        self.assertIn("FORMAL_GATES_ACCEPTED=4/10", self.wrapper)
        self.assertIn('"officialGatesPassed": 4', self.verifier)
        self.assertNotIn('"officialGatesPassed": 3', self.verifier)


if __name__ == "__main__":
    unittest.main()
