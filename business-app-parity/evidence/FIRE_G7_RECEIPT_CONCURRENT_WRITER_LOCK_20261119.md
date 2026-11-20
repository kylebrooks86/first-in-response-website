# FIRE Gate 7 — restore-receipt concurrent writer guard (Nov 19, 2026)

## Executed source and regression on DRAFT PR #270 (NO DEPLOY)

The owner-local, READ-ONLY `release/owner_backup_cadence_review.ps1` already denied concurrent writes when examining its selected SQL export and encrypted photo envelope, but the companion `.restore-review.json` receipt was still loaded with `Get-Content` after a separate `Get-Item` precheck. Another process could hold a writable handle while receipt bytes were read. Raw file failures also risked revealing an owner's private path.

**Actual source change:** [`93fbb1aed8aa97293faa9a43aed3efe8d2f4a660`](https://github.com/kylebrooks86/first-in-response-website/commit/93fbb1aed8aa97293faa9a43aed3efe8d2f4a660) changes receipt review to use `FileAccess.Read, FileShare.Read`, validates length from the same handle before bounded UTF-8/JSON parsing, releases resources in `finally`, and maps IO errors to bounded `RECORDS_RECEIPT_READ_UNAVAILABLE` rather than printing a private path. Existing receipt target UUID, exact expected QA review status, export length and SHA256 checks are preserved. This does NOT authenticate capture age, encrypt receipt, pair photos, or perform recovery.

**New targeted regression:** [`c082f93820f67b80394fe24cd66df52a8d2370de`](https://github.com/kylebrooks86/first-in-response-website/commit/c082f93820f67b80394fe24cd66df52a8d2370de) updates `release/test_owner_backup_cadence_review.ps1`: an independent Windows PowerShell child process invokes the real reviewer while another process holds a writable receipt file handle. Test requires nonzero exit, `RECORDS_RECEIPT_READ_UNAVAILABLE`, no owner path disclosure, and no false `LOCAL_SQL_HASH_RECEIPT=PASS`. Existing valid receipt, photo writer race, SQL writer race, old-copy false freshness, path boundary, wrong D1, tampering, invalid photo header and stale cadence regressions remain in the same synthetic test.

## Independently observed test results

- [**FIRE Owner Backup Cadence Safety Actions run 44517557462**](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44517557462): **COMPLETED SUCCESS**, actual Windows PowerShell job `135537412424` **SUCCESS** on exact source/test commit `c082f93820f67b80394fe24cd66df52a8d2370de`; job log emits `PASS: synthetic G7 backup cadence accepted/invalid/stale; no provider or private data.` and no failed step.
- [**FIRE App-Only Main Integration website/calculator preservation run 44517557554**](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44517557554): **COMPLETED SUCCESS** on that same SHA. The change affects only the owner-local Gate7 scripts; no public website or calculator code change.

## Acceptance boundary

**Source correctness and the synthetic targeted Windows regression are DONE.** This is a completed preparation subtask inside still-open **G7-10**, not evidence that real owner data was backed up or restored, capture timestamp attested, off-device custody verified, or QA/STAGING/DR/NEW LIVE hosted Gate7 approved.

**Release board unchanged: 50/95 accepted, 45 open; formal 4/10 G1/G2/G3/G8 accepted; G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK/NO-GO; first real Job #0001 not issued.** Do not rerun owner Acer G4 readback (already stopped), repeated Cloudflare browser sign-ins, accepted QA three-photo restore/iPhone captures or any Stripe TEST. No Cloudflare provider call, R2 subscription, SQL writes, Stripe money, owner photo records, Git merge, Worker deployment, DNS or production release was performed.
