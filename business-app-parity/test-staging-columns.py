import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('checker', ROOT / 'check-staging-columns.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class ColumnEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expected = checker.expected_columns()
        cls.evidence = json.loads((ROOT / 'STAGING_COLUMNS_EVIDENCE.json').read_text())

    def altered(self, mutation):
        evidence = copy.deepcopy(self.evidence)
        mutation(evidence)
        self.assertFalse(checker.compare(evidence, self.expected)['columnNamesMatch'])

    def test_real_evidence_matches_without_claiming_release_safety(self):
        report = checker.compare(self.evidence, self.expected)
        self.assertTrue(report['columnNamesMatch'])
        self.assertEqual(report['tablesChecked'], 19)
        self.assertFalse(report['productionReady'])
        self.assertFalse(report['completeRemoteSchemaVerified'])

    def test_missing_column(self):
        self.altered(lambda e: e['tables'][0]['columns'].pop())

    def test_extra_column(self):
        self.altered(lambda e: e['tables'][0]['columns'].append('unrecognized'))

    def test_missing_table(self):
        self.altered(lambda e: e['tables'].pop())

    def test_extra_table(self):
        self.altered(lambda e: e['tables'].append({'name': 'unexpected', 'columns': [], 'omittedColumns': 0}))

    def test_omitted_projection(self):
        self.altered(lambda e: e['tables'][0].update(omittedColumns=1))

    def test_duplicate_table(self):
        self.altered(lambda e: e['tables'].append(copy.deepcopy(e['tables'][0])))

    def test_duplicate_column(self):
        self.altered(lambda e: e['tables'][0]['columns'].append(e['tables'][0]['columns'][0]))

    def test_wrong_target(self):
        self.altered(lambda e: e.update(projectId='different-project'))


if __name__ == '__main__':
    unittest.main()
