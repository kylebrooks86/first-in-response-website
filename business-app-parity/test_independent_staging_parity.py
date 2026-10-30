"""Verify staging can be assembled from the SAME app sources as iPhone QA.

Only auth, fixed app namespace, root environment label, and build config may
differ. This is local source parity, not an attestation of hosted versions.
"""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from verify_materialized_candidate import check

ROOT = Path(__file__).resolve().parent
EXCLUDED = {
    'vite.config.ts', 'app/page.tsx', 'app/manifest.ts', 'app/local-customer-deployment.ts',
    'app/chatgpt-auth.ts', 'app/owner-auth.ts', 'app/login/page.tsx',
    'app/api/auth/login/route.ts', 'app/api/auth/logout/route.ts',
    'app/api/app-version/route.ts', 'app/api/staging-fixtures/route.ts',
}

def inventory(root):
    result = {}
    for area in ('app','lib','components','db','public','hooks','vendor'):
        directory = root / area
        if directory.exists():
            result.update({p.relative_to(root).as_posix(): p.read_bytes()
                           for p in directory.rglob('*') if p.is_file()})
    return result

class IndependentStagingParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = TemporaryDirectory(prefix='fire-qa-staging-parity-')
        cls.qa = Path(cls.workspace.name) / 'qa'
        cls.staging = Path(cls.workspace.name) / 'independent-staging'
        for target, destination in (('qa',cls.qa),('independent-staging',cls.staging)):
            subprocess.run([sys.executable,str(ROOT/'materialize.py'),target,str(destination)],
                           check=True, capture_output=True, text=True)
    @classmethod
    def tearDownClass(cls):
        cls.workspace.cleanup()

    def test_full_source_assemblies_have_reviewed_fingerprints(self):
        self.assertTrue(check('qa',self.qa)['identicalToSharedPlusAuthorizedAdapter'])
        result = check('independent-staging', self.staging)
        self.assertTrue(result['identicalToSharedPlusAuthorizedAdapter'])
        self.assertEqual(result['migrationFiles'],25)

    def test_shared_visual_and_business_code_is_byte_identical(self):
        qa = inventory(self.qa)
        staging = inventory(self.staging)
        all_paths = set(qa) | set(staging)
        core = [p for p in all_paths if p not in EXCLUDED]
        self.assertGreater(len(core),100,'Missing shared business/UI sources')
        differences = sorted(p for p in core if qa.get(p) != staging.get(p))
        self.assertFalse(differences, 'QA and staging core app drifted: ' + ', '.join(differences[:20]))

    def test_independent_staging_preserves_owner_auth_and_exact_schema(self):
        for path in ('app/owner-auth.ts','app/api/auth/login/route.ts',
                     'app/api/auth/logout/route.ts','app/chatgpt-auth.ts'):
            self.assertEqual((self.staging/path).read_bytes(),
                             (ROOT/'adapters'/'doomsday'/path).read_bytes(),
                             path)
        qa_sql = {p.name:p.read_bytes() for p in (self.qa/'drizzle').glob('*.sql')}
        stage_sql = {p.name:p.read_bytes() for p in (self.staging/'drizzle').glob('*.sql')}
        self.assertEqual(qa_sql,stage_sql)
        self.assertEqual(len(qa_sql),25)

    def test_page_diff_is_only_staging_environment_label(self):
        baseline = (ROOT/'adapters'/'doomsday'/'app/page.tsx').read_text()
        stage = (self.staging/'app/page.tsx').read_text()
        self.assertEqual(baseline.count('environment="DOOMSDAY"'),1)
        self.assertEqual(stage,baseline.replace('environment="DOOMSDAY"',
                                                'environment="STAGING"'))

    def test_tampered_core_app_fails_closed(self):
        target = self.staging/'app/dashboard.tsx'
        original = target.read_bytes()
        try:
            target.write_bytes(original+b'\n// unreviewed UI drift\n')
            with self.assertRaisesRegex(ValueError,'fingerprint mismatch'):
                check('independent-staging',self.staging)
        finally:
            target.write_bytes(original)

    def test_incorrect_environment_namespace_fails_closed(self):
        target = self.staging/'app/local-customer-deployment.ts'
        original = target.read_bytes()
        try:
            target.write_text(original.decode().replace("'staging'","'qa'"))
            with self.assertRaisesRegex(ValueError,'(fingerprint mismatch|identity does not match)'):
                check('independent-staging',self.staging)
        finally:
            target.write_bytes(original)

if __name__ == '__main__':
    unittest.main()
