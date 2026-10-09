import copy
import json
import hashlib
from pathlib import Path
import tempfile
import unittest

from candidate_release_manifest import build_manifest, verify_manifest


class CandidateManifest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "shared/app").mkdir(parents=True)
        (self.root / "shared/app/dashboard.tsx").write_text("shared candidate")
        for target in ["live", "doomsday", "staging"]:
            directory = self.root / "adapters" / target
            (directory / "drizzle").mkdir(parents=True)
            (directory / "drizzle/0000_fixture.sql").write_text("CREATE TABLE fixture(id TEXT);")
            (directory / "ABSENT_FILES.json").write_text("[]")
        (self.root / "PROGRESS_STATUS.json").write_text(json.dumps({"productionReadiness": {"gatesPassed": 3, "totalGates": 10, "percent": 30, "pending": ["remote checks"]}}))
        for name in ["CANDIDATE_COMMITS.json", "FIRE_DEPLOYMENT_INVENTORY.json"]:
            (self.root / name).write_text("{}")

    def tearDown(self):
        self.temp.cleanup()

    def manifest(self):
        return build_manifest(self.root, "a" * 40)

    def test_deterministic_and_never_authorizes_publication(self):
        first = self.manifest()
        self.assertEqual(first, self.manifest())
        self.assertTrue(verify_manifest(self.root, first))
        self.assertEqual(first["overallVerifiedReadiness"]["percent"], 30)
        self.assertFalse(first["publicationAuthorized"])
        self.assertFalse(first["productionReady"])
        forged = copy.deepcopy(first)
        forged["publicationAuthorized"] = True
        with self.assertRaises(ValueError):
            verify_manifest(self.root, forged)

    def test_source_and_migration_drift_rejected(self):
        sealed = self.manifest()
        source = self.root / "shared/app/dashboard.tsx"
        source.write_text("changed")
        with self.assertRaises(ValueError):
            verify_manifest(self.root, sealed)
        source.write_text("shared candidate")
        (self.root / "adapters/doomsday/drizzle/0000_fixture.sql").write_text("different migration")
        with self.assertRaises(ValueError):
            verify_manifest(self.root, sealed)

    def test_migration_gap_and_unsafe_absence_rejected(self):
        directory = self.root / "adapters/doomsday"
        (directory / "drizzle/0002_gap.sql").write_text("SELECT 1;")
        with self.assertRaisesRegex(ValueError, "sequence"):
            self.manifest()
        (directory / "drizzle/0002_gap.sql").unlink()
        (directory / "ABSENT_FILES.json").write_text('["../outside"]')
        with self.assertRaisesRegex(ValueError, "absence"):
            self.manifest()

    def test_symlink_and_inconsistent_progress_rejected(self):
        link = self.root / "shared/app/link"
        link.symlink_to(self.root / "shared/app/dashboard.tsx")
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.manifest()
        link.unlink()
        p = self.root / "PROGRESS_STATUS.json"
        data = json.loads(p.read_text())
        data["productionReadiness"]["percent"] = 90
        p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "percentage"):
            self.manifest()

    def test_unapproved_shared_application_override_rejected(self):
        directory = self.root / "adapters/doomsday/app"
        directory.mkdir()
        (directory / "dashboard.tsx").write_text("drifted dashboard")
        with self.assertRaisesRegex(ValueError, "differs"):
            self.manifest()


    def add_reliability_evidence(self):
        snapshots = {target: str(index) * 40 for index, target in enumerate(["live", "doomsday", "staging"], 1)}
        (self.root / "CANDIDATE_COMMITS.json").write_text(json.dumps({"reliabilityRecoveryCandidateCommits": snapshots}))
        digest = hashlib.sha256((self.root / "shared/app/dashboard.tsx").read_bytes()).hexdigest()
        (self.root / "RELIABILITY_RECOVERY_EVIDENCE.json").write_text(json.dumps({
            "candidateSnapshotCommits": snapshots, "changedFilesSha256": {"shared/app/dashboard.tsx": digest}}))
        return snapshots

    def add_native_evidence(self):
        overview = {"project_id": "appgprj_6aaf416f82c88191a292fa2e13a9ea61", "bindings": ["DB"],
            "selected_binding_name": "DB", "tables": [], "model_projection": {
                "omitted_bindings": 0, "omitted_tables": 0, "truncated": False,
                "omitted_project_id": False, "omitted_selected_binding": False}}
        # A forged stored success summary must not override actual table names.
        (self.root / "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json").write_text(json.dumps({
            "live": {"tableOverview": overview}, "tableComparisons": {"live": {"tableNamesMatch": True}}}))

    def test_exact_latest_snapshot_references(self):
        snapshots = self.add_reliability_evidence()
        result = self.manifest()
        for target in snapshots:
            self.assertEqual(result["targets"][target]["candidateSnapshotCommitReference"], snapshots[target])
        self.assertIn("RELIABILITY_RECOVERY_EVIDENCE.json", result["inputFilesSha256"])

    def test_wrong_and_incomplete_snapshot_references(self):
        for snapshots in [{"live": "1" * 40}, {t: "not-a-commit" for t in ["live", "doomsday", "staging"]}]:
            (self.root / "CANDIDATE_COMMITS.json").write_text(json.dumps({"reliabilityRecoveryCandidateCommits": snapshots}))
            with self.assertRaisesRegex(ValueError, "all three exact"):
                self.manifest()

    def test_snapshot_evidence_mismatch(self):
        self.add_reliability_evidence()
        path = self.root / "CANDIDATE_COMMITS.json"
        commits = json.loads(path.read_text())
        commits["reliabilityRecoveryCandidateCommits"]["live"] = "f" * 40
        path.write_text(json.dumps(commits))
        with self.assertRaisesRegex(ValueError, "conflict"):
            self.manifest()

    def test_reliability_source_drift(self):
        self.add_reliability_evidence()
        (self.root / "shared/app/dashboard.tsx").write_text("unverified new behavior")
        with self.assertRaisesRegex(ValueError, "source has changed"):
            self.manifest()

    def test_reliability_evidence_drift(self):
        self.add_reliability_evidence()
        manifest = self.manifest()
        path = self.root / "RELIABILITY_RECOVERY_EVIDENCE.json"
        data = json.loads(path.read_text())
        data["checksPassed"] = "altered result"
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            verify_manifest(self.root, manifest)

    def test_native_blocker_recomputed_from_observed_names(self):
        self.add_native_evidence()
        result = self.manifest()
        live = result["targets"]["live"]["nativeTablePreflight"]
        self.assertFalse(live["tableNamesMatch"])
        self.assertEqual(live["missingTables"], ["fixture"])
        self.assertFalse(result["productionReady"])
        self.assertFalse(result["targets"]["doomsday"]["nativeTablePreflight"]["observed"])
        manifest = result
        path = self.root / "DEPLOYED_IDENTITY_TABLE_EVIDENCE.json"
        data = json.loads(path.read_text())
        data["live"]["tableOverview"]["tables"] = ["fixture"]
        path.write_text(json.dumps(data))
        self.assertTrue(self.manifest()["targets"]["live"]["nativeTablePreflight"]["tableNamesMatch"])
        self.assertFalse(self.manifest()["productionReady"])
        with self.assertRaises(ValueError):
            verify_manifest(self.root, manifest)

    def test_unsafe_reliability_path_and_boolean_counts(self):
        self.add_reliability_evidence()
        path = self.root / "RELIABILITY_RECOVERY_EVIDENCE.json"
        data = json.loads(path.read_text())
        data["changedFilesSha256"] = {"shared/../../secret": "anything"}
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "Invalid reliability"):
            self.manifest()
        path.unlink()
        path = self.root / "PROGRESS_STATUS.json"
        data = json.loads(path.read_text())
        data["productionReadiness"].update(gatesPassed=True, percent=10)
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "counts"):
            self.manifest()

    def add_latest_evidence(self):
        self.add_reliability_evidence()
        snapshots = {target: str(index) * 40 for index, target in enumerate(["live", "doomsday", "staging"], 4)}
        source = self.root / "shared/app/dashboard.tsx"
        source.write_text("verified newer invoice presentation")
        commits = json.loads((self.root / "CANDIDATE_COMMITS.json").read_text())
        commits.update(latestVerifiedCandidateCommits=snapshots,
                       latestVerifiedCandidateEvidence="LATEST_UI_EVIDENCE.json")
        (self.root / "CANDIDATE_COMMITS.json").write_text(json.dumps(commits))
        evidence = {"candidateSnapshotCommits": snapshots,
            "changedFilesSha256": {"shared/app/dashboard.tsx": hashlib.sha256(source.read_bytes()).hexdigest()},
            "suiteRunsPassed": 3, "suiteRunsTotal": 3,
            "typescriptTargetsPassed": 3, "typescriptTargetsTotal": 3,
            "buildTargetsPassed": 3, "buildTargetsTotal": 3,
            "resultsByTarget": {target: {"ui": {"exitCode": 0}, "typescriptExitCode": 0, "buildExitCode": 0}
                                for target in snapshots}, "productionReady": False, "deployed": False}
        self.write_latest(evidence)
        return evidence

    def write_latest(self, evidence):
        (self.root / "LATEST_UI_EVIDENCE.json").write_text(json.dumps(evidence))

    def test_latest_snapshot_and_historical_provenance(self):
        evidence = self.add_latest_evidence()
        before = (self.root / "RELIABILITY_RECOVERY_EVIDENCE.json").read_bytes()
        manifest = self.manifest()
        for target, commit in evidence["candidateSnapshotCommits"].items():
            self.assertEqual(manifest["targets"][target]["candidateSnapshotCommitReference"], commit)
        provenance = manifest["verifiedCandidateEvidence"]
        self.assertEqual(provenance["latestEvidenceFile"], "LATEST_UI_EVIDENCE.json")
        self.assertIn("shared/app/dashboard.tsx", provenance["historicalReliabilitySourcesSuperseded"])
        self.assertIn("LATEST_UI_EVIDENCE.json", manifest["inputFilesSha256"])
        self.assertTrue(verify_manifest(self.root, manifest))
        self.assertEqual(before, (self.root / "RELIABILITY_RECOVERY_EVIDENCE.json").read_bytes())
        self.assertFalse(manifest["productionReady"])

    def test_latest_partial_pointer_pair_rejected(self):
        self.add_latest_evidence()
        path = self.root / "CANDIDATE_COMMITS.json"
        original = json.loads(path.read_text())
        for key in ["latestVerifiedCandidateCommits", "latestVerifiedCandidateEvidence"]:
            with self.subTest(key=key):
                data = copy.deepcopy(original)
                del data[key]
                path.write_text(json.dumps(data))
                with self.assertRaisesRegex(ValueError, "together"):
                    self.manifest()

    def test_latest_unsafe_and_missing_evidence_rejected(self):
        self.add_latest_evidence()
        path = self.root / "CANDIDATE_COMMITS.json"
        data = json.loads(path.read_text())
        for value in ["../LATEST_UI_EVIDENCE.json", "/tmp/OTHER_EVIDENCE.json", "shared/LATEST_UI_EVIDENCE.json", None]:
            with self.subTest(value=value):
                data["latestVerifiedCandidateEvidence"] = value
                path.write_text(json.dumps(data))
                with self.assertRaisesRegex(ValueError, "pointer"):
                    self.manifest()
        data["latestVerifiedCandidateEvidence"] = "MISSING_EVIDENCE.json"
        path.write_text(json.dumps(data))
        with self.assertRaises(FileNotFoundError):
            self.manifest()

    def test_latest_wrong_snapshot_and_source_rejected(self):
        evidence = self.add_latest_evidence()
        evidence["candidateSnapshotCommits"]["live"] = "f" * 40
        self.write_latest(evidence)
        with self.assertRaisesRegex(ValueError, "conflict"):
            self.manifest()
        self.add_latest_evidence()
        (self.root / "shared/app/dashboard.tsx").write_text("unverified changes")
        with self.assertRaisesRegex(ValueError, "latest source has changed"):
            self.manifest()

    def test_latest_incomplete_or_boolean_counts_rejected(self):
        evidence = self.add_latest_evidence()
        for key, value in [("suiteRunsPassed", 2), ("buildTargetsPassed", True),
                           ("typescriptTargetsTotal", 2), ("suiteRunsTotal", 0)]:
            with self.subTest(key=key):
                data = copy.deepcopy(evidence)
                data[key] = value
                self.write_latest(data)
                with self.assertRaisesRegex(ValueError, "counts|three target"):
                    self.manifest()

    def test_latest_failed_and_missing_target_results_rejected(self):
        evidence = self.add_latest_evidence()
        for key in ["buildExitCode", "typescriptExitCode", "ui"]:
            for value in [1, False]:
                with self.subTest(key=key, value=value):
                    data = copy.deepcopy(evidence)
                    data["resultsByTarget"]["staging"][key] = {"exitCode": value} if key == "ui" else value
                    self.write_latest(data)
                    with self.assertRaisesRegex(ValueError, "failed"):
                        self.manifest()
        del evidence["resultsByTarget"]["doomsday"]
        self.write_latest(evidence)
        with self.assertRaisesRegex(ValueError, "missing target"):
            self.manifest()

    def test_latest_suite_counts_and_claims_rejected(self):
        evidence = self.add_latest_evidence()
        data = copy.deepcopy(evidence)
        data.update(suiteRunsPassed=6, suiteRunsTotal=6)
        self.write_latest(data)
        with self.assertRaisesRegex(ValueError, "suite counts"):
            self.manifest()
        for key in ["productionReady", "deployed"]:
            data = copy.deepcopy(evidence)
            data[key] = True
            self.write_latest(data)
            with self.assertRaisesRegex(ValueError, "must not claim"):
                self.manifest()

    def test_latest_evidence_mutation_invalidates_review(self):
        evidence = self.add_latest_evidence()
        manifest = self.manifest()
        evidence["reviewNote"] = "Changed evidence"
        self.write_latest(evidence)
        with self.assertRaises(ValueError):
            verify_manifest(self.root, manifest)

    def test_latest_does_not_cover_unrelated_reliability_drift(self):
        self.add_latest_evidence()
        path = self.root / "shared/app/another.tsx"
        path.write_text("verified recovery helper")
        evidence_path = self.root / "RELIABILITY_RECOVERY_EVIDENCE.json"
        data = json.loads(evidence_path.read_text())
        data["changedFilesSha256"]["shared/app/another.tsx"] = hashlib.sha256(path.read_bytes()).hexdigest()
        evidence_path.write_text(json.dumps(data))
        self.manifest()
        path.write_text("unverified helper")
        with self.assertRaisesRegex(ValueError, "reliability source has changed"):
            self.manifest()

    def test_latest_unsafe_hashes_and_evidence_symlink_rejected(self):
        evidence = self.add_latest_evidence()
        for name, digest in [("shared/../outside", "a" * 64), ("shared/app/dashboard.tsx", "bad")]:
            data = copy.deepcopy(evidence)
            data["changedFilesSha256"] = {name: digest}
            self.write_latest(data)
            with self.assertRaisesRegex(ValueError, "Invalid latest"):
                self.manifest()
        self.write_latest(evidence)
        path = self.root / "LATEST_UI_EVIDENCE.json"
        path.rename(self.root / "ORIGINAL_EVIDENCE.json")
        path.symlink_to(self.root / "ORIGINAL_EVIDENCE.json")
        with self.assertRaisesRegex(ValueError, "symlinks"):
            self.manifest()



if __name__ == "__main__":
    unittest.main()
