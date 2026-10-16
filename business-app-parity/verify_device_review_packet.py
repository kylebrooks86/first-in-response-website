"""Verify a previously sealed FIRE review ZIP and commit receipt. READ ONLY.

This is a chain-of-custody check, NOT permission to publish or install the app.
Never extracts or executes any archive member, reads hosted resources or secrets.
"""
import argparse
import hashlib
import json
import re
import stat
import zipfile
from pathlib import Path

TARGETS = {"live", "doomsday", "staging"}
HASH = re.compile(r"^[0-9a-f]{64}$")
MAX_ZIP = 512 * 1024 * 1024
MAX_EXPANDED = 2 * 1024 * 1024 * 1024
MAX_ENTRIES = 20000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def hash_file(path):
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def safe_member(info):
    name = info.filename
    parts = name.split("/")
    require(name.startswith(("source/", "build/"))
            and len(parts) >= 3
            and not name.startswith("/")
            and "\\" not in name
            and not any(part in ("", ".", "..") for part in parts)
            and not any(ord(char) < 32 or ord(char) == 127 for char in name)
            and not name.endswith("/"),
            "Review ZIP contains an unsafe entry path")
    mode = info.external_attr >> 16
    require(not info.is_dir() and stat.S_IFMT(mode) not in (stat.S_IFLNK, stat.S_IFDIR),
            "Review ZIP contains non-file entries")
    require(not (info.flag_bits & 1) and info.compress_type in
            (zipfile.ZIP_DEFLATED, zipfile.ZIP_STORED),
            "Review ZIP contains an unsupported or encrypted entry")
    require(not any(part.startswith((".env", ".dev.vars")) or
                    part.endswith((".db", ".sqlite", ".zip")) for part in parts)
            and not name.endswith(".map")
            and "photo-fixture" not in name
            and not (name.startswith("build/") and
                     any(part.startswith("wrangler") for part in parts)),
            "Review ZIP contains excluded data or hosting configuration")
    return name


def verify(directory, target, checkpoint):
    require(target in TARGETS, "Invalid FIRE candidate target")
    root = Path(directory)
    require(root.is_dir() and not root.is_symlink(), "Review directory unavailable or linked")
    receipt_path = root / "DEVICE_REVIEW_RECEIPT.json"
    require(receipt_path.is_file() and not receipt_path.is_symlink()
            and receipt_path.stat().st_size <= 4 * 1024 * 1024,
            "Review receipt missing, linked or oversized")
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    require(isinstance(receipt, dict)
            and receipt.get("format") == "fire-device-candidate-review"
            and receipt.get("version") == 1
            and receipt.get("baseCheckpoint") == checkpoint,
            "Review receipt format or exact source checkpoint mismatch")
    require(receipt.get("publicationAuthorized") is False
            and receipt.get("physicalDeviceAcceptance") is False
            and receipt.get("installableURL") is None
            and receipt.get("officialReadinessPercent") == 30,
            "Review receipt makes an unsupported release or device claim")
    targets = receipt.get("targets")
    require(isinstance(targets, dict) and set(targets) == {target},
            "Review receipt target identity mismatch")
    t = targets[target]
    require(isinstance(t, dict)
            and t.get("hostingConfigIncluded") is False
            and t.get("recordsIncluded") is False
            and t.get("publicationAuthorized") is False,
            "Candidate review receipt contains unsafe publication claims")
    sha = t.get("sha256")
    fingerprint = t.get("sourceBuildFingerprint")
    require(isinstance(sha, str) and bool(HASH.fullmatch(sha))
            and isinstance(fingerprint, str) and bool(HASH.fullmatch(fingerprint)),
            "Invalid review hash metadata")
    filename = "FIRE_Device_Review_" + target + "_" + fingerprint[:12] + ".zip"
    require(t.get("archive") == filename, "Review archive name is not fingerprint-bound")
    require(all(p.is_file() and not p.is_symlink()
                for p in root.iterdir())
            and {p.name for p in root.iterdir()} ==
            {"DEVICE_REVIEW_RECEIPT.json", filename},
            "Review folder contains unexpected or linked files")
    archive = root / filename
    require(archive.stat().st_size <= MAX_ZIP
            and hash_file(archive) == sha,
            "Review ZIP hash mismatch or size limit exceeded")
    expected = t.get("fileSha256")
    require(isinstance(expected, dict)
            and 0 < len(expected) <= MAX_ENTRIES
            and t.get("fileCount") == len(expected)
            and all(isinstance(k, str) and isinstance(v, str)
                    and HASH.fullmatch(v) for k, v in expected.items()),
            "Review receipt entry inventory is invalid")
    hashes = {}
    total = 0
    with zipfile.ZipFile(archive, "r") as opened:
        members = opened.infolist()
        require(len(members) == len(expected), "Review ZIP entry count mismatch")
        for entry in members:
            name = safe_member(entry)
            require(name not in hashes and name in expected,
                    "Review ZIP contains duplicate or undeclared entries")
            total += entry.file_size
            require(total <= MAX_EXPANDED, "Expanded review archive exceeds limit")
            actual = hashlib.sha256()
            with opened.open(entry, "r") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    actual.update(block)
            value = actual.hexdigest()
            require(value == expected[name], "Review ZIP file hash mismatch")
            hashes[name] = value
        require(set(hashes) == set(expected), "Review ZIP file inventory mismatch")
        build_id = "build/server/BUILD_ID"
        require(build_id in hashes, "Built candidate identity missing")
        require(opened.getinfo(build_id).file_size < 128
                and opened.read(build_id).decode("utf-8").strip() == t.get("buildId"),
                "Build ID does not match sealed receipt")
    computed = digest(json.dumps(hashes, sort_keys=True,
                                 separators=(",", ":")).encode("utf-8"))
    require(computed == fingerprint, "Candidate file inventory fingerprint mismatch")
    return {"target": target, "checkpoint": checkpoint,
            "fileCount": len(hashes), "totalVerifiedBytes": total,
            "archiveSha256": sha, "sourceBuildFingerprint": fingerprint,
            "readOnly": True, "publicationAuthorized": False,
            "installableURL": None, "physicalDeviceAcceptance": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packet", required=True, type=Path)
    parser.add_argument("--target", required=True, choices=sorted(TARGETS))
    parser.add_argument("--checkpoint", required=True)
    args = parser.parse_args()
    try:
        verified = verify(args.packet, args.target, args.checkpoint)
    except (OSError, ValueError, zipfile.BadZipFile, UnicodeError) as exc:
        parser.exit(1, "BLOCKED: FIRE candidate review packet did not verify (" +
                    type(exc).__name__ + "). No archive contents were extracted.\n")
    print(json.dumps(verified, sort_keys=True))


if __name__ == "__main__":
    main()
