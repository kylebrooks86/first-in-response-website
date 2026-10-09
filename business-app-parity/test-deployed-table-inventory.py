"""Read-only preflight regression: no cloud access or operational database writes."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('table_inventory', ROOT / 'check-deployed-table-inventory.py')
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)
EVIDENCE = json.loads((ROOT / 'DEPLOYED_IDENTITY_TABLE_EVIDENCE.json').read_text())


class TableInventoryTests(unittest.TestCase):
    def check(self, target, overview=None):
        return inspector.compare(overview if overview is not None else EVIDENCE[target]['tableOverview'], target, inspector.expected_tables(target))

    def test_observed_live_gap(self):
        result = self.check('live')
        self.assertFalse(result['tableNamesMatch'])
        self.assertEqual(result['missingTables'], ['payment_refunds'])
        self.assertEqual(result['matchedTableNames'], 18)
        self.assertEqual(result['candidateTableCount'], 19)

    def test_observed_staging_names(self):
        self.assertTrue(self.check('staging')['tableNamesMatch'])

    def test_matching_names_never_release(self):
        result = self.check('staging')
        for key in ['completeRemoteSchemaVerified', 'resourceIsolationVerified', 'migrationJournalVerified', 'productionReady']:
            self.assertIs(result[key], False)

    def test_synthetic_live_schema(self):
        overview = copy.deepcopy(EVIDENCE['live']['tableOverview'])
        overview['tables'].append('payment_refunds')
        self.assertTrue(self.check('live', overview)['tableNamesMatch'])

    def test_wrong_project(self):
        self.assertFalse(self.check('live', EVIDENCE['staging']['tableOverview'])['tableNamesMatch'])

    def test_wrong_binding(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview['selected_binding_name'] = 'OTHER'
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_omitted_table(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview['model_projection']['omitted_tables'] = 1
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_unknown_projection(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview.pop('model_projection')
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_truncated_projection(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview['model_projection']['truncated'] = True
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_duplicates(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview['tables'].append(overview['tables'][0])
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_unexpected_table(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        overview['tables'].append('unexpected')
        self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_malformed_collection(self):
        overview = copy.deepcopy(EVIDENCE['staging']['tableOverview'])
        for rows in [None, {}, ['customers', None], ['customers', {}]]:
            with self.subTest(rows=rows):
                overview['tables'] = rows
                self.assertFalse(self.check('staging', overview)['tableNamesMatch'])

    def test_unverified_doomsday_rejected(self):
        with self.assertRaises(ValueError):
            inspector.expected_tables('doomsday')

    def test_cli_expected_status_and_read_only_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'evidence.json'
            original = json.dumps(EVIDENCE).encode()
            path.write_bytes(original)
            for target, expected in [('live', 1), ('staging', 0)]:
                result = subprocess.run([sys.executable, str(ROOT / 'check-deployed-table-inventory.py'), '--target', target, '--evidence', str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, expected, result.stderr)
                self.assertIs(json.loads(result.stdout)['productionReady'], False)
            self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
