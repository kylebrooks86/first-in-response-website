"""Verify an OWNER-HELD, already-25-migration FIRE QA D1 SQL export OFFLINE.

No Cloudflare, network, SQL export, credential access or hosted database write.
Restore only inside in-memory SQLite; duplicate an independent in-memory copy,
then verify schema, journaling, rows, foreign keys and financial ledger.
No customer/payment/record contents, SQL, private paths or secrets printed.
A local copy cannot attest export origin, freshness, retention or recovery
of cloud photos. Even PASS never authorizes a deployment or release gate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

import capture_existing_qa_schema_read_only as qa
from review_qa_update_schema import (
    HISTORICAL_GIT_BLOBS, NEW_GIT_BLOBS, _read_sql_dir, _verify_pinned
)
from verify_doomsday_d1_export import (
    MAX_EXPORT_BYTES, sql_authorizer, schema_inventory,
    read_only_ledger_counts
)
from verify_qa_d1_export import data_digest, expected, schema_matches

FULL_PINS = {**HISTORICAL_GIT_BLOBS, **NEW_GIT_BLOBS}
FULL_NAMES = sorted(FULL_PINS)
LAST_QA_WORKER_VERSION = "99fa8c27-df83-48d3-b953-9a84eb295334"
FORMAT = "fire-private-qa-current25-offline-validation-v1"

class CurrentQAExportStop(ValueError):
    def __init__(self, code, stage, checks, failure=None):
        super().__init__(code)
        engine = getattr(failure, "sqlite_errorname", None)
        self.receipt = {
            "format": FORMAT,
            "status": "BLOCKED",
            "stage": stage,
            "diagnosticCode": code,
            "checks": dict(checks),
            "sqliteErrorName": engine if isinstance(engine,str) and re.fullmatch(r"SQLITE_[A-Z_]+",engine) else None,
            "privateRowsExposed": False,
            "remoteOperationsPerformed": False,
            "backupOriginVerified": False,
            "completeCloudPhotosVerified": False,
            "hostedRestoreTested": False,
            "qaUpdateAuthorized": False,
            "productionReleaseAuthorized": False,
            "officialGatesPassed": 3,
            "officialGatesTotal": 10,
        }


def verify_current25_export(path, *, expected_sha256):
    stage = "INPUT"
    checks = {}
    primary = None
    recovered = None
    def fail(code, reason=None):
        raise CurrentQAExportStop(code, stage, checks, reason)
    try:
        file = Path(path)
        if file.is_symlink() or not file.is_file() or file.suffix.lower() != ".sql":
            fail("INVALID_OWNER_PRIVATE_SQL_FILE")
        if not 0 < file.stat().st_size <= MAX_EXPORT_BYTES:
            fail("EXPORT_SIZE_OUTSIDE_LIMIT")
        if not isinstance(expected_sha256,str) or not re.fullmatch("[0-9a-f]{64}",expected_sha256):
            fail("EXPECTED_SHA256_INVALID")
        source = file.read_bytes()
        digest = hashlib.sha256(source).hexdigest()
        checks["exactOwnerExportSha256"] = digest == expected_sha256
        if not checks["exactOwnerExportSha256"]:
            fail("OWNER_EXPORT_SHA256_MISMATCH")

        stage = "PINNED_25_MIGRATION_SOURCE"
        checks["all25SourceMigrationsPinned"] = False
        migrations = _verify_pinned(_read_sql_dir(qa.BASE,"current QA 25"),FULL_PINS,"current QA 25")
        checks["all25SourceMigrationsPinned"] = True
        assert len(FULL_NAMES) == 25 and FULL_NAMES[-1] == "0024_deposit_agreement_snapshots.sql"
        canonical = expected(migrations, FULL_NAMES)

        stage = "OFFLINE_SQL_RESTORE"
        primary = sqlite3.connect(":memory:")
        primary.enable_load_extension(False)
        primary.set_authorizer(sql_authorizer)
        primary.executescript(source.decode("utf-8-sig"))
        primary.execute("PRAGMA query_only=ON")
        checks["exportRestoredIntoMemory"] = True

        stage = "EXACT_CURRENT_25_REVIEW"
        checks["sqliteIntegrityClean"] = primary.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        checks["foreignKeysClean"] = primary.execute("PRAGMA foreign_key_check").fetchall() == []
        rows = primary.execute("SELECT id,name FROM d1_migrations ORDER BY id").fetchall()
        checks["journalExactly25WithContiguousIds"] = (
            rows == [(i+1,name) for i,name in enumerate(FULL_NAMES)]
        )
        checks["journalHasNoExecutableTriggers"] = primary.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND tbl_name='d1_migrations'"
        ).fetchone()[0] == 0
        actual = schema_inventory(primary)
        checks["schemaExactlyPinned25"] = schema_matches(actual,canonical)
        checks["criticalRefundAndSignedAgreementObjectsPresent"] = all(
            primary.execute("SELECT COUNT(*) FROM sqlite_master WHERE type=? AND name=?",
                            (kind,name)).fetchone()[0] == 1
            for kind,name in (
                ("table","payment_refunds"),
                ("table","deposit_policy_events"),
                ("table","deposit_agreement_snapshots"),
                ("index","idx_payments_stripe_provider_unique"),
                ("trigger","deposit_agreement_snapshots_no_update"),
                ("trigger","deposit_agreement_snapshots_no_delete"),
            )
        )
        stage = "PRIVATE_FINANCIAL_INTEGRITY"
        checks["financialLedgerAnomaliesZero"] = read_only_ledger_counts(primary) == [0,0,0,0]
        if not all(checks.values()):
            fail("CURRENT_25_SCHEMA_JOURNAL_OR_LEDGER_MISMATCH")

        stage = "ISOLATED_RECOVERY_REPLAY"
        tables = [r[1] for r in actual if r[0] == "table"] + ["d1_migrations"]
        original_digest = data_digest(primary,tables)
        recovered = sqlite3.connect(":memory:")
        primary.backup(recovered)
        recovered.execute("PRAGMA query_only=ON")
        checks["independentInMemoryRecoveryPreservedAllRows"] = (
            data_digest(recovered,tables) == original_digest
        )
        checks["recoveredSchemaExactlyPinned25"] = schema_matches(schema_inventory(recovered),canonical)
        checks["recovered25JournalUnchanged"] = (
            recovered.execute("SELECT id,name FROM d1_migrations ORDER BY id").fetchall() == rows
        )
        checks["recoveredForeignKeysClean"] = recovered.execute("PRAGMA foreign_key_check").fetchall() == []
        checks["recoveredIntegrityClean"] = recovered.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        checks["recoveredFinancialLedgerAnomaliesZero"] = read_only_ledger_counts(recovered) == [0,0,0,0]
        checks["originalOwnerSqlUnchanged"] = hashlib.sha256(file.read_bytes()).hexdigest() == digest
        stage = "FINAL"
        if not all(checks.values()):
            fail("OFFLINE_25_REPLAY_OR_INPUT_CHANGED")
        return {
            "format": FORMAT,
            "status": "OFFLINE_CURRENT_QA_25_RESTORE_PASSED",
            "target": qa.NAME,
            "assertedQAUuid": qa.UUID,
            "lastOwnerObservedQAWorkerVersion": LAST_QA_WORKER_VERSION,
            "exportBytes": len(source),
            "exportSha256": digest,
            "checks": checks,
            "privateRowsExposed": False,
            "remoteOperationsPerformed": False,
            "backupOriginVerified": False,
            "completeCloudPhotosVerified": False,
            "hostedRestoreTested": False,
            "qaUpdateAuthorized": False,
            "productionReleaseAuthorized": False,
            "officialGatesPassed": 3,
            "officialGatesTotal": 10,
        }
    except CurrentQAExportStop:
        raise
    except sqlite3.Error as error:
        fail("SQLITE_RESTORE_OR_INTEGRITY_FAILED",error)
    except UnicodeError:
        fail("SQL_EXPORT_ENCODING_UNSAFE")
    except (ValueError,AssertionError):
        fail("PINNED_SQL_OR_INPUT_UNSAFE")
    except OSError:
        fail("LOCAL_OWNER_FILE_UNAVAILABLE")
    finally:
        if primary is not None:
            primary.close()
        if recovered is not None:
            recovered.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("private_sql",type=Path)
    parser.add_argument("--expected-sha256",required=True)
    a=parser.parse_args()
    try:
        result=verify_current25_export(a.private_sql,expected_sha256=a.expected_sha256)
        print(json.dumps(result,indent=2))
        return 0
    except CurrentQAExportStop as error:
        print(json.dumps(error.receipt,indent=2))
        return 2

if __name__=="__main__":
    sys.exit(main())
