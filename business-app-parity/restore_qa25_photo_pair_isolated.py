r"""FIRE G7-07: owner-only offline restore of saved QA photos into a new isolated folder.

No Cloudflare, uploads, database writes, R2, or provider calls. Original input files
remain unchanged. Restored original photos are PLAINTEXT in the output directory:
keep the directory private and do not place it in public/shared cloud storage.

Usage (from business-app-parity with Python 3 and Node 22+):
 python restore_qa25_photo_pair_isolated.py QA.sql PHOTOS.firephotos C:\Users\...\FIRE-G7-Isolated-Photos
"""
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import uuid
import zipfile

from verify_doomsday_d1_export import MAX_EXPORT_BYTES, sql_authorizer

ROOT = Path(__file__).resolve().parent
MAX_ZIP = 161 * 1024 * 1024
PHOTO_READ = r"""
import {readUnchangedSavedProtectedPhotoFile, inspectStoredFirePhotoZip}
  from './verify_saved_protected_photo_backup.mjs';
import {recoverProtectedOfflinePhotoZip, isProtectedOfflinePhotoArchive}
  from './shared/lib/protected-offline-photo-archive.mjs';
let secret = '', bytesRead = 0;
for await (const chunk of process.stdin) {
  bytesRead += chunk.length;
  if (bytesRead > 4096) throw Error('Unsupported private passphrase input');
  secret += chunk.toString('utf8');
}
const saved = await readUnchangedSavedProtectedPhotoFile(process.argv[1]);
const source = new Blob([saved]);
if (!await isProtectedOfflinePhotoArchive(source)) throw Error('Not an encrypted FIRE photo file');
const zipBlob = await recoverProtectedOfflinePhotoZip(source, JSON.parse(secret));
const zip = Buffer.from(await zipBlob.arrayBuffer());
const checked = inspectStoredFirePhotoZip(zip, {includePhotoInventory:true});
if (checked.photoCount < 1) throw Error('No originals to restore');
process.stdout.write(zip);
"""
EXT = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
       'image/gif': '.gif', 'image/avif': '.avif', 'image/heic': '.heic',
       'image/heif': '.heif', 'image/bmp': '.bmp'}


def checked_sql(sql):
    if not sql.is_file() or not 0 < sql.stat().st_size <= MAX_EXPORT_BYTES:
        raise ValueError('Current QA SQL export missing or outside supported size')
    receipt = json.loads(Path(str(sql) + '.restore-review.json').read_text(encoding='utf-8-sig'))
    raw = sql.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if (receipt.get('exportSha256') != sha or receipt.get('exportBytes') != len(raw)
            or receipt.get('assertedQAUuid') != '8ccfb1f8-1657-4074-b1b2-47de78f95003'
            or receipt.get('status') != 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED'):
        raise ValueError('Export does not match accepted QA D1 restore receipt')
    db = sqlite3.connect(':memory:')
    try:
        db.set_authorizer(sql_authorizer)
        db.executescript(raw.decode('utf-8-sig'))
        db.execute('PRAGMA query_only=ON')
        return db, sha
    except BaseException:
        db.close()
        raise


def checked_photo_zip(photo, phrase, db):
    if not photo.is_file() or not 64 < photo.stat().st_size <= MAX_ZIP + 4096:
        raise ValueError('Saved encrypted photo archive missing or too large')
    result = subprocess.run(
        ['node', '--input-type=module', '-e', PHOTO_READ, str(photo.resolve())],
        cwd=ROOT, input=json.dumps(phrase).encode('utf-8'),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        # Distinguish stopped local-tool stages WITHOUT printing stderr, file paths,
        # photo metadata, credentials, customer records, or decrypted bytes.
        err = result.stderr.decode('utf-8', errors='replace').lower()
        if 'wrong passphrase or damaged protected file' in err:
            stage = 'CIPHERTEXT_AUTHENTICATION_OR_KEY_STOP'
        elif 'saved photo backup missing, replaced or unsupported' in err:
            stage = 'LOCAL_ENCRYPTED_FILE_READ_STOP'
        elif 'not an encrypted fire photo file' in err:
            stage = 'ENCRYPTED_FORMAT_HEADER_STOP'
        elif 'fire saved photo recovery review blocked:' in err:
            stage = 'VERIFIED_ZIP_FORMAT_OR_INTEGRITY_STOP'
        elif 'err_module_not_found' in err or 'cannot find module' in err:
            stage = 'RESTORE_SOURCE_MODULE_STOP'
        elif 'syntaxerror' in err or 'referenceerror' in err or 'typeerror' in err:
            stage = 'LOCAL_NODE_HELPER_RUNTIME_STOP'
        else:
            stage = 'UNCLASSIFIED_NODE_STOP'
        raise ValueError('Photo recovery stopped safely at ' + stage
                         + '; no isolated photo files were written')
    if not 22 < len(result.stdout) <= MAX_ZIP:
        raise ValueError('Photo recovery stopped safely at INVALID_DECRYPTED_ZIP_LENGTH'
                         '; no isolated photo files were written')
    zipbytes = result.stdout
    with zipfile.ZipFile(io.BytesIO(zipbytes), 'r') as zipped:
        names = zipped.namelist()
        manifest_bytes = zipped.read('manifest.json')
        manifest = json.loads(manifest_bytes)
        photos = manifest['photos']
        if not isinstance(photos, list) or not photos:
            raise ValueError('No original photos in authenticated manifest')
        expected = {'manifest.json'} | {'photos/' + p['id'] for p in photos}
        if len(expected) != len(photos) + 1 or set(names) != expected or len(names) != len(expected):
            raise ValueError('Saved ZIP inventory mismatch')
        originals = []
        for item in photos:
            if not re.fullmatch(r'[a-zA-Z0-9_-]{1,90}', item['id']):
                raise ValueError('Unsafe photo ID')
            if item['contentType'] not in EXT:
                raise ValueError('Unsupported original photo content type')
            if not db.execute('SELECT 1 FROM customers WHERE id=?', (item['customerId'],)).fetchone():
                raise ValueError('Saved photo customer missing from paired QA records')
            if 'jobId' in item and not db.execute(
                'SELECT 1 FROM estimates WHERE id=? AND customer_id=?',
                (item['jobId'], item['customerId'])).fetchone():
                raise ValueError('Saved photo job/customer link mismatch')
            data = zipped.read('photos/' + item['id'])
            if len(data) != item['sizeBytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
                raise ValueError('Original photo bytes do not match saved manifest')
            originals.append((item, data))
    return originals, manifest_bytes, hashlib.sha256(zipbytes).hexdigest()


def isolated_restore(sql, photo, out):
    if not sys.stdin.isatty():
        raise ValueError('Run interactively; the passphrase must not be echoed or logged')
    if not out.is_absolute() or out.exists() or out.is_symlink():
        raise ValueError('Output must be a NEW absolute local folder, never an existing folder')
    if not re.fullmatch(r'[a-zA-Z0-9_.-]{1,100}', out.name):
        raise ValueError('Unsupported isolated output folder name')
    if not out.parent.is_dir() or out.parent.is_symlink():
        raise ValueError('Create/select an existing private, non-symlink parent folder')
    db, sql_hash = checked_sql(sql)
    try:
        phrase = getpass.getpass('Photo backup passphrase (hidden): ')
        try:
            originals, manifest_bytes, zip_hash = checked_photo_zip(photo, phrase, db)
        finally:
            phrase = None
    finally:
        db.close()
    temp = out.parent / ('.' + out.name + '.partial-' + uuid.uuid4().hex)
    try:
        temp.mkdir(mode=0o700)
        (temp / 'photos').mkdir(mode=0o700)
        (temp / 'manifest.json').write_bytes(manifest_bytes)
        mappings = []
        for item, raw in originals:
            name = item['id'] + EXT[item['contentType']]
            target = temp / 'photos' / name
            with target.open('xb') as handle:
                handle.write(raw)
            disk = target.read_bytes()  # physically reopen the restored original
            if len(disk) != item['sizeBytes'] or hashlib.sha256(disk).hexdigest() != item['sha256']:
                raise ValueError('Reopened isolated original photo failed hash comparison')
            mappings.append({'id': item['id'], 'category': item['category'],
                             'customerId': item['customerId'], 'jobId': item.get('jobId'),
                             'file': 'photos/' + name, 'sha256': item['sha256'],
                             'bytes': item['sizeBytes']})
        receipt = {'status': 'OFFLINE_ISOLATED_QA_PHOTOS_RESTORED_AND_REOPENED',
                   'sourceSqlSha256': sql_hash, 'verifiedZipSha256': zip_hash,
                   'originalPhotosReopened': len(originals),
                   'jobLinksPresent': sum('jobId' in x for x, _ in originals),
                   'photos': mappings, 'cloudProviderWrites': False}
        (temp / 'isolated-restore-receipt.json').write_text(
            json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
        if out.exists():
            raise ValueError('Destination became occupied; refusing overwrite')
        temp.rename(out)
    except BaseException:
        if temp.exists():
            shutil.rmtree(temp)
        raise
    print('ISOLATED_RESTORE_PASS')
    print('ORIGINAL_PHOTOS_REOPENED=' + str(len(originals)))
    print('JOB_LINKS_PRESENT=' + str(receipt['jobLinksPresent']))
    print('QA_SQL_SHA256=' + sql_hash)
    print('VERIFIED_ZIP_SHA256=' + zip_hash)
    print('RESTORED_LOCATION=' + str(out))
    print('Cloud/provider writes: NONE. Originals kept unchanged.')
    print('PRIVACY: restored photo files are plaintext; keep this folder private.')


if __name__ == '__main__':
    try:
        if len(sys.argv) != 4:
            raise ValueError('Usage: python restore_qa25_photo_pair_isolated.py QA.sql PHOTOS.firephotos NEW_PRIVATE_FOLDER')
        isolated_restore(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
    except (OSError, ValueError, KeyError, RuntimeError, sqlite3.Error, zipfile.BadZipFile,
            json.JSONDecodeError, FileNotFoundError) as error:
        sys.exit('STOP: local input or isolated restore verification failed: ' + str(error))
