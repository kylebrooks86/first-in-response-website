#!/usr/bin/env python3
"""Seal/read back an inert Gate9 TEST Worker-only source package. No provider calls.
CLI:
  python seal_gate9_test_inactive_source.py seal PRIVATE_FOLDER SOURCE_SHA OUTSIDE_MANIFEST.json
  python seal_gate9_test_inactive_source.py verify PRIVATE_FOLDER SOURCE_SHA MANIFEST.json
The manifest is OUTSIDE the private package; source/runtime cannot approve a POST.
"""
import hashlib
import json
import os
import pathlib
import re
import sys

WORKER = "fire-stripe-test-20261101"
DB = "dba421ba-fc66-4cf8-9c31-51616f8249ba"
PREDECESSOR = "96e32262-fa33-4f04-a161-bee11f0353e2"
RECEIPT = "gate9-noassets-dark-source-receipt.json"
MANIFEST_KIND = "FIRE_GATE9_TEST_INACTIVE_SOURCE_CUSTODY_NO_PROVIDER_V1"
RECEIPT_KIND = "FIRE_GATE9_TEST_FULLAPP_WORKER_ONLY_PRIVATE_SOURCE_REVIEW_V1"
SECRET_NAMES = ["FIRE_ACCESS_AUD", "FIRE_ACCESS_OWNER_EMAIL",
                "FIRE_ACCESS_TEAM_DOMAIN", "STRIPE_WEBHOOK_SECRET"]


def refuse(reason):
    raise ValueError("FIRE G9 SOURCE SEAL BLOCKED: " + reason)


def require(cond, why):
    if not cond:
        refuse(why)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def file_bytes(path):
    return path.read_bytes()


def loaded(path):
    try:
        return json.loads(file_bytes(path))
    except (OSError, ValueError, UnicodeError) as exc:
        raise ValueError("FIRE G9 SOURCE SEAL BLOCKED: missing or invalid JSON") from exc


def exact_tree(folder):
    require(folder.is_dir() and not folder.is_symlink(), "missing or linked source folder")
    rows = []
    for parent, dirs, files in os.walk(folder):
        dirs.sort()
        files.sort()
        for name in dirs + files:
            p = pathlib.Path(parent) / name
            require(not p.is_symlink(), "linked source item")
        for name in files:
            p = pathlib.Path(parent) / name
            st = p.stat()
            require(p.is_file() and st.st_nlink == 1 and 0 < st.st_size < 25_000_000,
                    "unreviewed file shape or size")
            rel = p.relative_to(folder).as_posix()
            require(re.fullmatch(r"[a-zA-Z0-9_./-]+", rel) and
                    ".." not in rel.split("/"), "unsafe source path")
            raw = file_bytes(p)
            rows.append({"path": rel, "bytes": len(raw), "sha256": digest(raw)})
    return sorted(rows, key=lambda row: row["path"])


def verify_package(folder, source):
    require(re.fullmatch(r"[0-9a-f]{40}", source), "exact Git source SHA required")
    receipt = loaded(folder / RECEIPT)
    config = loaded(folder / "server/wrangler.json")
    require(receipt.get("kind") == RECEIPT_KIND and receipt.get("sourceSha") == source,
            "wrong owner TEST reviewed source")
    require(receipt.get("worker") == WORKER and receipt.get("providerContacted") is False and
            receipt.get("workerUploaded") is False and receipt.get("deployed") is False and
            receipt.get("newProviderVersionCreated") is False and
            receipt.get("firstProviderChangeAuthorized") is False,
            "owner TEST source claims unapproved provider mutation")
    require(receipt.get("r2Required") is False and
            receipt.get("stripeModeEnabled") is False and
            receipt.get("cloudAssetsUploadSessionRequired") is False,
            "TEST source has unsupported paid storage/payment or upload session")
    server = receipt.get("originalServerFiles")
    assets = receipt.get("originalClientAssets")
    require(isinstance(server, list) and len(server) >= 180 and
            isinstance(assets, list) and len(assets) == 41,
            "TEST complete SSR/41 compiled static assets missing")
    rows = exact_tree(folder)
    require(len(rows) >= 235 and len(rows) <= 300, "unreviewed package file count")
    saved = receipt.get("savedInventory")
    require(isinstance(saved, list) and saved ==
            [r for r in rows if r["path"] != RECEIPT],
            "package modules/assets changed since saved receipt")
    require(digest(json.dumps(saved, separators=(",", ":"), ensure_ascii=False).encode()) ==
            receipt.get("savedInventoryDigest"), "saved source inventory commitment differs")
    inventory = {r["path"]: r for r in rows}
    for row in server:
        rel = row.get("path")
        require(isinstance(rel, str) and rel.startswith("server/") and
                rel in inventory and inventory[rel] == row, "TEST SSR module hash altered")
    for asset in assets:
        rel = "server/" + asset.get("module", "")
        require(rel in inventory and
                inventory[rel]["sha256"] == asset.get("sha256") and
                inventory[rel]["bytes"] == asset.get("bytes"),
                "TEST original compiled client Data byte altered")
    require(config.get("name") == WORKER and
            config.get("main") == "fire-gate9-noassets-entry.mjs" and
            config.get("workers_dev") is False and config.get("preview_urls") is False and
            config.get("routes") == [] and config.get("r2_buckets") == [] and
            "assets" not in config and "legacy_env" not in config,
            "TEST Worker has public route, assets session or paid R2")
    require(config.get("d1_databases") == [{
                "binding": "DB", "database_name": "fire-stripe-test-db-20261101",
                "database_id": DB}], "wrong TEST physical database binding")
    require(config.get("vars") == {
        "FIRE_ENV": "cloudflare-staging",
        "SITE_ORIGIN": "https://fire-stripe-test-20261101.kyle-bfc.workers.dev",
        "FIRE_ACCESS_REQUIRED": "enabled",
        "FIRE_STRIPE_MODE": "disabled",
        "FIRE_GATE9_PRIVATE_ACTIVATION": "blocked"
    }, "TEST inactive/Stripe/Access mode changed")
    require(config.get("secrets") == {"required": SECRET_NAMES},
            "TEST required secret NAMES changed")
    return receipt, rows


def expected_manifest(folder, source):
    receipt, rows = verify_package(folder, source)
    return {
        "kind": MANIFEST_KIND,
        "sourceCommitSha": source,
        "worker": WORKER,
        "physicalTestD1": DB,
        "serverModuleCount": len(receipt["originalServerFiles"]),
        "clientAssetCount": len(receipt["originalClientAssets"]),
        "packageFileCount": len(rows),
        "packageFileTreeSha256": digest(json.dumps(rows, separators=(",", ":"),
                                                ensure_ascii=False).encode()),
        "packageReceiptSha256": digest(file_bytes(folder / RECEIPT)),
        "packageSavedInventorySha256": receipt["savedInventoryDigest"],
        "workerConfigSha256": digest(file_bytes(folder / "server/wrangler.json")),
        "stripeMode": "disabled",
        "activation": "blocked",
        "noR2": True,
        "noCloudflareAssetsSession": True,
        "historicalServingPredecessor": PREDECESSOR,
        "preMutationLiveVersionReadbackRequired": True,
        "exactOwnerApprovalRequiredBeforeAnyProviderPOST": True,
        "independentAccessAndRefundSchemaVerificationStillRequired": True,
        "rollbackMustBeApprovedSeparately": True,
        "rollbackOrDeployExecuted": False,
        "cloudflareWorkerVersionCreated": False,
        "stripeEventDelivered": False,
        "cloudflareOrStripeContacted": False,
        "formalGate9Accepted": False,
        "releaseNoGo": True,
    }


def main(argv):
    require(len(argv) == 4 and argv[0] in ("seal", "verify"),
            "usage: seal|verify PRIVATE_FOLDER EXACT_SOURCE_SHA EXTERNAL_MANIFEST")
    cmd, root, source, manifest = argv
    folder, outfile = pathlib.Path(root).resolve(), pathlib.Path(manifest).absolute()
    require(outfile != folder and folder not in outfile.parents,
            "external seal must not enter immutable package")
    expected = expected_manifest(folder, source)
    if cmd == "seal":
        require(not outfile.exists(), "never overwrite a previous immutable seal")
        with outfile.open("x", encoding="utf-8") as f:
            json.dump(expected, f, sort_keys=True, indent=2)
            f.write("\n")
    else:
        require(loaded(outfile) == expected, "source/asset/receipt differs from external seal")
    print("PASS Gate9 exact TEST-only inert source file/member/digest/rollback seal; "
          "NO provider/Access/D1/Stripe operation. "
          f"files={expected['packageFileCount']} assets={expected['clientAssetCount']} "
          f"manifestSHA256={digest(file_bytes(outfile))}")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
