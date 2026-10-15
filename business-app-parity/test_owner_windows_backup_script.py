"""Static safety contract and optional no-network dry-run of Windows owner backup helper."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT=Path(__file__).resolve().parent/"owner_windows_doomsday_backup.ps1"

class WindowsOwnerBackupSafety(unittest.TestCase):
    def test_no_remote_call_without_export_and_typed_uuid(self):
        source=SCRIPT.read_text(encoding="utf-8")
        self.assertIn("[switch]$Export",source)
        self.assertIn("if (-not $Export)",source)
        self.assertIn("DRY RUN ONLY",source)
        self.assertIn("Read-Host",source)
        self.assertIn("EXPORT ' + $uuid",source)
        self.assertLess(source.index("if (-not $Export)"),source.index("Read-Host"))
        self.assertLess(source.index("Read-Host"),source.index("d1 list --json"))
        self.assertLess(source.index("d1 list --json"),source.index("d1 export $target --remote"))
        self.assertIn("$_.name -ceq $target",source)
        self.assertIn("$_.uuid -ceq $uuid",source)
        self.assertIn("afb2c05a-d794-4a9a-b580-924ce01c26ad",source)
        self.assertEqual(source.count("d1 export $target --remote"),1)
        self.assertNotIn("d1 execute",source)
        self.assertNotIn("migrations apply",source)
        self.assertNotIn("time-travel restore",source)
        self.assertNotIn(" wrangler deploy",source)
        self.assertNotIn("--no-data",source)
        self.assertNotIn("--skip-confirmation",source)

    def test_owner_backup_stays_private_and_checked_before_acceptance(self):
        source=SCRIPT.read_text(encoding="utf-8")
        self.assertIn("FIRE-Private-Backups",source)
        self.assertIn("Refusing to write a private SQL backup inside the Git repository",source)
        self.assertIn("Get-FileHash",source)
        self.assertIn("verify_doomsday_d1_export.py",source)
        self.assertIn("rehearse_doomsday_0022_export.py",source)
        self.assertLess(source.index("$verifier $path"),source.index("$rehearsal $path"))
        self.assertIn("NOT hosted migration approval",source)
        self.assertIn("Keep the file private",source)

    @unittest.skipUnless(shutil.which("pwsh"),"PowerShell not available on this runner; Windows execution requires owner laptop")
    def test_dry_run_does_not_login_or_write_any_export(self):
        with tempfile.TemporaryDirectory() as folder:
            env=os.environ.copy()
            env["USERPROFILE"]=folder
            process=subprocess.run(["pwsh","-NoProfile","-NonInteractive","-File",str(SCRIPT)],
                                   capture_output=True,text=True,timeout=30,env=env)
            self.assertEqual(process.returncode,0,process.stderr)
            self.assertIn("DRY RUN ONLY",process.stdout)
            self.assertEqual(list(Path(folder).rglob("*.sql")),[])
            self.assertEqual(list(Path(folder).rglob("*.json")),[])

if __name__=="__main__":
    unittest.main(verbosity=2)
