"""Synthetic CI coverage for the local-only historical archive intake."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from zipfile import ZipFile

from verify_private_expired_source_archives import read_exact, sha


class ArchiveIntakeTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / 'fixture.zip'

    def write_fixture(self, last_member='server/module-241.mjs'):
        with ZipFile(self.path, 'w') as archive:
            for index in range(241):
                archive.writestr(f'server/module-{index}.mjs', f'fixture {index}')
            archive.writestr(last_member, 'fixture 241')
        raw = self.path.read_bytes()
        return {'dr_original': (sha(raw), len(raw))}

    def test_missing_private_input_fails(self):
        with self.assertRaisesRegex(ValueError, 'missing or unsafe'):
            read_exact(self.path, 'dr_original')

    def test_generated_zip_cannot_pose_as_historical_original(self):
        self.write_fixture()
        with self.assertRaisesRegex(ValueError, 'wrong original saved byte size|wrong original saved ZIP SHA256'):
            read_exact(self.path, 'dr_original')

    def test_exact_fixture_reads_all_members(self):
        with patch('verify_private_expired_source_archives.EXPECTED', self.write_fixture()):
            files = read_exact(self.path, 'dr_original')
        self.assertEqual(len(files), 242)
        self.assertEqual(files['server/module-241.mjs'], b'fixture 241')

    def test_same_size_mutation_fails_before_zip_read(self):
        pins = self.write_fixture()
        raw = bytearray(self.path.read_bytes())
        raw[100] ^= 1
        self.path.write_bytes(raw)
        with patch('verify_private_expired_source_archives.EXPECTED', pins):
            with self.assertRaisesRegex(ValueError, 'wrong original saved ZIP SHA256'):
                read_exact(self.path, 'dr_original')

    def test_unsafe_paths_fail_even_when_fixture_digest_matches(self):
        for name in ('../escape', 'server/./escape', 'server//escape', 'C:/escape'):
            with self.subTest(name=name):
                with patch('verify_private_expired_source_archives.EXPECTED', self.write_fixture(name)):
                    with self.assertRaisesRegex(ValueError, 'unsafe or duplicate ZIP path'):
                        read_exact(self.path, 'dr_original')


if __name__ == '__main__':
    unittest.main()
