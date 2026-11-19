"""FIRE G7-07 owner Acer isolated ORIGINAL-photo ZIP recovery; LOCAL ONLY.

Requires already-verified QA25 .sql plus its .restore-review.json receipt and
the owner-held 4,593,469-byte encrypted .firephotos archive. Restored ZIP is
UNENCRYPTED; never share it or commit it. No Cloudflare, Stripe, D1 or deploy.
"""
import getpass
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

from verify_qa25_saved_photo_pair import PHOTO_CHECK
from verify_doomsday_d1_export import MAX_EXPORT_BYTES, sql_authorizer

ROOT = Path(__file__).resolve().parent
QA_UUID = "8ccfb1f8-1657-4074-b1b2-47de78f95003"
SQL_BYTES = 55_305
PHOTO_BYTES = 4_593_469


def stop(message):
    raise ValueError("STOP: " + message)


def pick_file(label, pattern):
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
    except Exception:
        path = input(label + " (paste full path): ").strip().strip('"')
    else:
        try:
            path = filedialog.askopenfilename(
                parent=root, title=label, filetypes=[("Expected file", pattern), ("All files", "*.*")]
            )
        finally:
            root.destroy()
        if not path:
            stop("Selection cancelled without changing files.")
    file = Path(path).expanduser().resolve()
    if not file.is_file() or file.is_symlink():
        stop("Saved file missing or unsupported.")
    return file


def checksum(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def check_sql(sql):
    if sql.stat().st_size != SQL_BYTES or sql.stat().st_size > MAX_EXPORT_BYTES:
        stop("The accepted QA25 SQL export must be exactly 55,305 bytes.")
    receipt_file = Path(str(sql) + ".restore-review.json")
    if not receipt_file.is_file():
        stop("Matching SQL .restore-review.json receipt missing.")
    receipt = json.loads(receipt_file.read_text(encoding="utf-8-sig"))
    digest = checksum(sql)
    if (receipt.get("status") != "OFFLINE_CURRENT_QA_25_RESTORE_PASSED"
            or receipt.get("assertedQAUuid") != QA_UUID
            or receipt.get("exportSha256") != digest
            or receipt.get("exportBytes") != SQL_BYTES):
        stop("Original QA SQL export and its accepted restore receipt differ.")
    return digest


def check_photo(photo, phrase):
    p = subprocess.run(
        ["node", "--input-type=module", "-e", PHOTO_CHECK, str(photo)],
        cwd=ROOT, input=json.dumps(phrase), text=True, capture_output=True,
    )
    if p.returncode:
        stop("Encrypted original photo archive did not authenticate and verify.")
    proof = json.loads(p.stdout)
    if len(proof["photos"]) != 3 or proof["cipherHash"] != checksum(photo):
        stop("The original accepted 3-photo archive was not selected.")
    return proof


def check_customer_links(sql, photos):
    db = sqlite3.connect(":memory:")
    try:
        db.set_authorizer(sql_authorizer)
        db.executescript(sql.read_text(encoding="utf-8-sig"))
        db.execute("PRAGMA query_only=ON")
        jobs = 0
        for photo in photos:
            if not db.execute(
                "SELECT 1 FROM customers WHERE id=?", (photo["customerId"],)
            ).fetchone():
                stop("Photo references a customer missing from the accepted QA SQL.")
            if "jobId" in photo:
                jobs += 1
                if not db.execute(
                    "SELECT 1 FROM estimates WHERE id=? AND customer_id=?",
                    (photo["jobId"], photo["customerId"]),
                ).fetchone():
                    stop("Photo job link does not match the customer.")
        return jobs
    finally:
        db.close()


def main():
    if os.name != "nt" or not sys.stdin.isatty() or not os.environ.get("LOCALAPPDATA"):
        stop("Run interactively in Windows PowerShell on the owner Acer.")
    print("FIRE G7-07: isolated original-photo restore, no Cloudflare access.")
    sql = pick_file("Choose accepted QA25 .sql export", "*.sql")
    photo = pick_file("Choose encrypted saved photo backup", "*.firephotos")
    if photo == sql or photo.stat().st_size != PHOTO_BYTES:
        stop("Photo file is not the expected saved 4,593,469-byte original.")
    sql_hash = check_sql(sql)
    photo_hash = checksum(photo)
    secret = getpass.getpass("Existing photo backup password (hidden): ")
    if not 16 <= len(secret) <= 1024:
        stop("Recovery password length is invalid.")
    proof = check_photo(photo, secret)
    job_count = check_customer_links(sql, proof["photos"])
    private = Path(os.environ["LOCALAPPDATA"]) / "FIRE-Private-Isolated-Recovery"
    output = private / ("QA25-original-photos-"
                        + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
                        + ".zip")
    if output.exists() or output.is_symlink():
        stop("Refusing to overwrite an existing recovery ZIP.")
    print("Accepted SQL, 3 original photo hashes, and customer associations match.")
    print("The recovered ZIP is UNENCRYPTED, stored only in local folder:")
    print(str(private))
    if input("Type LOCAL RESTORE to confirm this local recovery: ").strip() != "LOCAL RESTORE":
        stop("Local recovery not approved; no output created.")
    private.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(
        ["node", str(ROOT / "recover_saved_protected_photo_zip.mjs"),
         str(photo), str(output), "--allow-plaintext-recovery"],
        cwd=ROOT, input=secret + "\n", text=True, capture_output=True,
    )
    try:
        if p.returncode:
            stop("Saved photo ZIP recovery failed authentication, write, or reread.")
        result = json.loads(p.stdout)
        if (result.get("photoCount") != 3
                or result.get("protectedPhotoSourceSha256") != photo_hash
                or result.get("verifiedZipSha256") != proof["zipHash"]
                or result.get("savedRecoveredZipSha256") != proof["zipHash"]
                or result.get("savedRecoveryZipReadBackVerified") is not True
                or result.get("allFilesCryptographicallyVerified") is not True
                or result.get("providerWriteAttempted") is not False
                or not output.is_file() or output.is_symlink()
                or checksum(output) != proof["zipHash"]
                or checksum(sql) != sql_hash or checksum(photo) != photo_hash):
            stop("Reopened local ZIP, photo hashes, or saved SQL/source identity differ.")
    except (OSError, ValueError, KeyError):
        if output.is_file() and not output.is_symlink():
            output.unlink()
        raise

    print()
    print("G7_07_ISOLATED_PHOTO_RESTORE=PASS")
    print("ORIGINAL_PHOTOS_REOPENED=3")
    print("CUSTOMER_ASSOCIATIONS_MATCH_SAVED_QA_SQL=YES")
    print("ARCHIVED_JOB_LINKS_PRESENT=" + str(job_count))
    print("EVERY_ORIGINAL_PHOTO_SHA256_REVERIFIED=YES")
    print("QA_SQL_SHA256=" + sql_hash)
    print("ENCRYPTED_PHOTOS_SHA256=" + photo_hash)
    print("RESTORED_ZIP_SHA256=" + result["savedRecoveredZipSha256"])
    print("REMOTE_WRITES_OR_DEPLOYMENT=NONE")
    print("PRIVATE_PLAINTEXT_ZIP=" + str(output))
    print("Keep the recovered ZIP private; do not upload or share the file.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, sqlite3.Error, subprocess.SubprocessError) as e:
        print(str(e) if type(e) is ValueError else "STOP: owner inputs or local recovery tools failed.", file=sys.stderr)
        sys.exit(1)
