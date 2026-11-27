"""Read-only owner Acer check for a saved QA25 SQL export and encrypted device photos."""
import getpass
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys

from verify_doomsday_d1_export import MAX_EXPORT_BYTES, sql_authorizer

ROOT = Path(__file__).resolve().parent
PHOTO_CHECK = """
import {readUnchangedSavedProtectedPhotoFile, inspectStoredFirePhotoZip}
  from './verify_saved_protected_photo_backup.mjs';
import {recoverProtectedOfflinePhotoZip} from './shared/lib/protected-offline-photo-archive.mjs';
import {createHash} from 'node:crypto';
const input = [];
for await (const chunk of process.stdin) input.push(chunk);
const bytes = await readUnchangedSavedProtectedPhotoFile(process.argv[1]);
const zip = await recoverProtectedOfflinePhotoZip(new Blob([bytes]), JSON.parse(Buffer.concat(input).toString('utf8')));
const result = inspectStoredFirePhotoZip(Buffer.from(await zip.arrayBuffer()), {includePhotoInventory:true});
console.log(JSON.stringify({cipherHash:createHash('sha256').update(bytes).digest('hex'),
  zipHash:result.verifiedZipSha256, photos:result.photoInventory}));
"""


def verify(sql, photo):
    receipt = json.loads(Path(str(sql) + '.restore-review.json').read_text(encoding='utf-8-sig'))
    if not 0 < sql.stat().st_size <= MAX_EXPORT_BYTES:
        raise ValueError('SQL size outside supported range')
    source = sql.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if (receipt.get('exportSha256') != digest or receipt.get('exportBytes') != len(source)
            or receipt.get('assertedQAUuid') != '8ccfb1f8-1657-4074-b1b2-47de78f95003'
            or receipt.get('status') != 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED'):
        raise ValueError('QA receipt does not match')
    if not sys.stdin.isatty():
        raise ValueError('Run interactively for private passphrase entry')
    phrase = getpass.getpass('Photo backup passphrase (hidden): ')
    check = subprocess.run(['node', '--input-type=module', '-e', PHOTO_CHECK, str(photo.resolve())],
                           cwd=ROOT, input=json.dumps(phrase), text=True, capture_output=True)
    if check.returncode:
        raise ValueError('Photo archive authentication or ZIP validation failed')
    proof = json.loads(check.stdout)
    db = sqlite3.connect(':memory:')
    try:
        db.set_authorizer(sql_authorizer)
        db.executescript(source.decode('utf-8-sig'))
        db.execute('PRAGMA query_only=ON')
        for p in proof['photos']:
            if not db.execute('SELECT 1 FROM customers WHERE id=?', (p['customerId'],)).fetchone():
                raise ValueError('Photo customer missing from QA records')
            if 'jobId' in p and not db.execute(
                    'SELECT 1 FROM estimates WHERE id=? AND customer_id=?',
                    (p['jobId'], p['customerId'])).fetchone():
                raise ValueError('Photo job estimate missing or belongs to another customer')
        print('PHOTO_COUNT=', len(proof['photos']), sep='')
        print('JOB_LINKS_PRESENT=', sum('jobId' in p for p in proof['photos']), sep='')
        print('QA_SQL_SHA256=' + digest)
        print('ENCRYPTED_PHOTOS_SHA256=' + proof['cipherHash'])
        print('VERIFIED_ZIP_SHA256=' + proof['zipHash'])
        print('PASS: saved photo bytes, manifest and recorded customer references match the QA export.')
    finally:
        db.close()


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]), Path(sys.argv[2]))
    except (OSError, ValueError, KeyError, sqlite3.Error, IndexError) as error:
        sys.exit(str(error) if type(error) is ValueError else 'STOP: local input or QA records check failed.')
