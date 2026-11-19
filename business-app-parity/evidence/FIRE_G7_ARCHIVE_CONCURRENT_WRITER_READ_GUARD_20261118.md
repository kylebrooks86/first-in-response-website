# November 18, 2026 — Gate 7 backup photo archive concurrent-write guard: source + actual Windows CI

## Real defect and exact fix

In the owner-local backup cadence read-only utility `release/owner_backup_cadence_review.ps1`, the `FIREPX01` header was opened with `FileShare.ReadWrite`. Another process could retain a writable file handle and alter the encrypted photo archive as the checker examined the header. The checker also took file length from earlier `Get-Item` metadata, rather than the same checked stream. Any IO error from the unguarded photo open could reveal a sensitive owner-local photo path to PowerShell output.

This was a **source-safety defect**, not evidence of actual changed customer/photo data. The utility deliberately validates only envelope structure; it never decrypts or authenticates original photos. The existing real QA three-original isolated restore remains valid and must not be repeated.

**Code [75f00c6](https://github.com/kylebrooks86/first-in-response-website/commit/75f00c6c9491a45cce2b0afc9921bd5ce986626e)**:
- Opens protected photo data read-only using `FileShare.Read`, rejecting a concurrently writable handle;
- Measures `FileStream.Length` and reads the first 48 bytes from that **same protected stream**;
- Validates actual measured length against bounded `48 + plaintextLength + 16 * chunkCount`;
- Catches unsafe file-open/read errors and emits only `PHOTO_ENVELOPE_READ_UNAVAILABLE` without raw exception or private path; keeps no remote/provider behavior.

**New real Windows regression [b8d4f23](https://github.com/kylebrooks86/first-in-response-website/commit/b8d4f234cab8e54bd1d9c23ab3d4ada60afdf4fd)**:
- Uses a synthetic `.firephotos` envelope under a temporary profile-local directory, opens an active writer with `FileShare.ReadWrite`, and runs the existing cadence checker in another Windows PowerShell child process.
- Requires fail-closed exit + sanitized `PHOTO_ENVELOPE_READ_UNAVAILABLE`, no private photo path and **no false `ENCRYPTED_PHOTO_HEADER_STRUCTURE=PASS`**.
- Existing synthetics for correctly shaped envelope, matching QA SQL receipt, altered SQL, wrong D1, invalid photo magic, copied-old age metadata, owner directory boundary, and stale reminder remain in the targeted workflow. No real owner data loaded.

## Exact actual CI evidence

- [**FIRE Owner Backup Cadence Safety workflow #44449425211**](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44449425211): **COMPLETED SUCCESS** on exact code/test head `b8d4f234cab8e54bd1d9c23ab3d4ada60afdf4fd`. Real Windows job `135309437960` **COMPLETED SUCCESS**; child-process script printed `PASS: synthetic G7 backup cadence accepted/invalid/stale; no provider or private data.`
- [Main-target public website/calculator guard #44449425200](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44449425200): **SUCCESS**.
- [Independent Verify FIRE website #44449425444](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44449425444): **SUCCESS**.

## Boundaries / release acceptance

This is a real targeted security fix to the **unmerged draft PR270 local read-only helper**, not a new hosted backup, full authenticated photo recovery, complete target-bound off-device custody, production restore or verified release gate. The previously accepted G7-02–G7-07 (including owner actual three-photo isolated restore) are unchanged; do not rerun them. G7-10 and Gate7 are still OPEN.

**Canonical 50/95 checked, 45 open; formal 4/10 G1/G2/G3/G8 accepted.** G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE remains DARK/NO-GO, first actual Job #0001 unissued. No Cloudflare API, Cloudflare Access, paid R2, Stripe payments, D1 SQL/provider writes, user photo reads, provider deployment, public website edit, merge or launch was performed.
