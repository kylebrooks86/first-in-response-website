"""Windows CRLF checkout parity: exact original pins, no private export rewriting."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import capture_existing_qa_schema_read_only as qa
from review_qa_update_schema import (HISTORICAL_GIT_BLOBS,NEW_GIT_BLOBS,QAReviewStop,
    _read_sql_dir,_verify_pinned,_git_blob_id,review)
from rehearse_qa_additive_schema import rehearse
import verify_qa_d1_export as verifier
from test_qa_d1_export import fixture

SOURCE=qa.BASE
PINS={**HISTORICAL_GIT_BLOBS,**NEW_GIT_BLOBS}
CHECKPOINT='2bbb3a9e7e86c59a1f156077b94628ec6a5f2d43'

class MigrationLineEndings(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='fire-crlf-migrations-')
        self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.canonical=_verify_pinned(_read_sql_dir(SOURCE,'trusted fixture source'),PINS,'trusted fixture source')

    def tree(self,name,style='lf',historical=False):
        root=self.root/name;root.mkdir()
        for i,(file,content) in enumerate(self.canonical.items()):
            if historical and file not in HISTORICAL_GIT_BLOBS:continue
            if style=='crlf':content=content.replace(b'\n',b'\r\n')
            elif style=='mixed':content=b''.join(line.replace(b'\n',b'\r\n') if n%2 else line for n,line in enumerate(content.splitlines(keepends=True)))
            (root/file).write_bytes(content)
        return root

    def test_all25_windows_crlf_files_verify_even_when_checkout_blobs_differ(self):
        root=self.tree('windows','crlf');raw=_read_sql_dir(root,'windows')
        self.assertTrue(any(_git_blob_id(raw[n])!=PINS[n] for n in raw))
        for n in raw:self.assertEqual(_git_blob_id(raw[n])!=PINS[n],b'\n' in self.canonical[n])
        self.assertEqual(_verify_pinned(raw,PINS,'windows'),self.canonical)
        self.assertEqual(raw,_read_sql_dir(root,'after'),'No source file was rewritten')

    def test_lf_crlf_and_mixed_variants_have_same_pinned_canonical_hashes(self):
        for style in ('lf','crlf','mixed'):
            with self.subTest(style=style):
                files=_read_sql_dir(self.tree(style,style),'fixture')
                result=_verify_pinned(files,PINS,'fixture')
                self.assertEqual(result,self.canonical)
                self.assertTrue(all(_git_blob_id(result[n])==PINS[n] for n in result))

    def test_mixed_archive_and_checkout_are_honest_about_raw_bytes(self):
        first=self.tree('old','lf',historical=True);latest=self.tree('new','crlf')
        result=review(first,latest,CHECKPOINT)
        self.assertFalse(result['originalMigrationsByteIdentical'])
        self.assertTrue(result['originalMigrationsLfEquivalent'])
        for row in result['additionalMigrations']:
            self.assertEqual(row['sha256'],hashlib.sha256(self.canonical[row['name']]).hexdigest())
            self.assertNotEqual(row['workingTreeSha256'],row['sha256'])
            self.assertTrue(row['crlfConversionObserved'])
        self.assertFalse(result['migrationPermissionGranted']);self.assertFalse(result['publicationAuthorized'])

    def test_whitespace_comments_bom_bare_cr_null_utf16_and_real_sql_edits_refused(self):
        transforms=(lambda b:b+b' ',lambda b:b+b'\n-- unapproved\n',lambda b:b'\xef\xbb\xbf'+b,
            lambda b:b+b'\r',lambda b:b+b'\0',lambda b:b.decode().encode('utf-16-le'),
            lambda b:b[:-1] if b.endswith(b'\n') else b+b'\n',lambda b:b+b'\nDROP TABLE payments;\n')
        for name in ('0000_wise_namora.sql','0023_deposit_policy_events.sql','0024_deposit_agreement_snapshots.sql'):
            for change in transforms:
                files=dict(self.canonical);files[name]=change(files[name]).replace(b'\n',b'\r\n')
                with self.subTest(name=name,change=change),self.assertRaises(QAReviewStop):_verify_pinned(files,PINS,'altered')

    def test_missing_extra_uppercase_malformed_and_directory_sql_are_refused(self):
        for mode in ('missing','extra','uppercase','malformed','directory'):
            root=self.tree(mode,'crlf')
            if mode=='missing':(root/'0024_deposit_agreement_snapshots.sql').unlink()
            elif mode=='extra':(root/'0025_unapproved.sql').write_bytes(b'SELECT 1;\r\n')
            elif mode=='uppercase':(root/'0025_unapproved.SQL').write_bytes(b'SELECT 1;\r\n')
            elif mode=='malformed':(root/'random.sql').write_bytes(b'SELECT 1;\r\n')
            else:(root/'0025_unapproved.sql').mkdir()
            with self.subTest(mode=mode),self.assertRaises(QAReviewStop):
                _verify_pinned(_read_sql_dir(root,'bad tree'),PINS,'bad tree')

    def test_crlf_baseline_capture_and_additive_rehearsal_are_equivalent(self):
        expected=qa.local_baseline();first=self.tree('baseline','lf',historical=True)
        latest=self.tree('candidate','crlf');before={p.name:p.read_bytes() for p in latest.iterdir()}
        with patch.object(qa,'BASE',latest):self.assertEqual(qa.local_baseline(),expected)
        result=rehearse(first,latest,CHECKPOINT)
        self.assertTrue(result['syntheticCustomerAndEstimatePreserved'])
        self.assertFalse(result['publicationAuthorized'])
        self.assertEqual(before,{p.name:p.read_bytes() for p in latest.iterdir()})

    def test_actual_export_fixture_restores_with_crlf_source_without_changing_any_bytes(self):
        backup=fixture(self.root);original=backup.read_bytes();sha=hashlib.sha256(original).hexdigest()
        latest=self.tree('restore-source','crlf');source_before={p.name:p.read_bytes() for p in latest.iterdir()}
        with patch.object(qa,'BASE',latest):result=verifier.review_export(backup,expected_sha256=sha)
        self.assertTrue(result['offlineRestoreAndAdditiveRehearsalPassed'])
        self.assertTrue(result['checks']['pinnedMigrationSourceVerified'])
        self.assertEqual(backup.read_bytes(),original)
        self.assertEqual(source_before,{p.name:p.read_bytes() for p in latest.iterdir()})
        self.assertFalse(result['hostedMigrationAuthorized']);self.assertFalse(result['publicationAuthorized'])

    def test_real_sql_tampering_still_stops_before_any_restore_statement(self):
        backup=fixture(self.root);sha=hashlib.sha256(backup.read_bytes()).hexdigest()
        latest=self.tree('tampered-source','crlf')
        with (latest/'0024_deposit_agreement_snapshots.sql').open('ab') as out:out.write(b'\r\nDROP TABLE payments;\r\n')
        with patch.object(qa,'BASE',latest),self.assertRaises(verifier.QAExportStop) as stopped:
            verifier.review_export(backup,expected_sha256=sha)
        r=stopped.exception.receipt
        self.assertEqual(r['stage'],'PINNED_SOURCE');self.assertEqual(r['restoreStatementsObserved'],0)
        self.assertFalse(r['checks']['pinnedMigrationSourceVerified']);self.assertFalse(r['hostedMigrationAuthorized'])

    def test_private_export_checksum_is_never_line_ending_normalized(self):
        backup=fixture(self.root);original=backup.read_bytes();sha=hashlib.sha256(original).hexdigest()
        backup.write_bytes(original.replace(b'\n',b'\r\n'));changed=backup.read_bytes()
        with self.assertRaises(verifier.QAExportStop) as stopped:verifier.review_export(backup,expected_sha256=sha)
        self.assertEqual(stopped.exception.receipt['diagnosticCode'],'EXPORT_HASH_MISMATCH')
        self.assertEqual(backup.read_bytes(),changed)

if __name__=='__main__':unittest.main(verbosity=2)
