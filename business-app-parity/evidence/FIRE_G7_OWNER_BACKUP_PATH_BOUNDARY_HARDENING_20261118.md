# FIRE G7 owner-backup local path-boundary hardening — November 18, 2026

**Scope:** Reviewed offline source/test change on existing **draft PR #270**. This is not new owner backup evidence, Cloudflare provider access, a hosted restore, or authorization to deploy.

## Real bug and change

The existing read-only `release/owner_backup_cadence_review.ps1` file eligibility guard used `$item.FullName.StartsWith($env:USERPROFILE)` without requiring a directory separator. Consequently, a separate lookalike sibling path (conceptually `C:\\Users\\owner-other`) could incorrectly pass the stated private owner-profile boundary for a profile named `C:\\Users\\owner`. Checking the file's own reparse flag also did not rule out a junction/reparse directory above it.

**Actual source corrections:**
- [`a31c90a`](https://github.com/kylebrooks86/first-in-response-website/commit/a31c90a99687e1be53ed67dae9d6a3b5dcf03f75): Normalize fully qualified owner and candidate file paths, require the true owner directory boundary, and refuse any reparse-point ancestor inside the owner profile with fixed non-sensitive STOP marker.
- [`3e6bd20`](https://github.com/kylebrooks86/first-in-response-website/commit/3e6bd20a3edc76a298a7fdee04a2c4b0d20696f2): Explicit `char[]` Windows separator trimming to avoid an incorrect PowerShell overload.
- [`c98b582`](https://github.com/kylebrooks86/first-in-response-website/commit/c98b5820f3193ec97980ffdfce46528e2727ec0c): Real child-process Windows PowerShell negative regression passing a fake owner-profile **text prefix that is NOT a directory ancestor**. Confirms strict rejection and no local file-path disclosure. Existing normal, wrong-target UUID, tampered SQL, bad encrypted envelope and stale-cadence assertions retained.

## Actual test receipt

At exact changed source/test commit `c98b5820f3193ec97980ffdfce46528e2727ec0c`:
- [`FIRE Owner Backup Cadence Safety (OFFLINE ONLY)` run #44439668684](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44439668684): **COMPLETED SUCCESS**; Windows job `135277074714`, actual `Run offline fail-closed Windows PowerShell tests` step SUCCESS.
- [`FIRE App-Only Main Integration — Preserve Public Website and Calculator` run #44439668369](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44439668369): **COMPLETED SUCCESS**, exact source-scope guard PASS.
- [`Verify FIRE website` run #44439668748](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44439668748): **COMPLETED SUCCESS**, independent site verification PASS.
- Other unrelated PR270 workflows were still in progress at the first readback; these specific completed jobs alone are the claimed proof.

This is a real fail-closed **source safety correction**, not evidence that a new private encrypted archive was generated or that all source hosts are equivalent. The already owner-accepted three-photo G7-07 restoration and G7-02–G7-06 remain accepted and should **not** be repeated.

**Release boundary:** Master checklist unchanged **50/95 completed, 45 open**; **4/10 formal release gates G1/G2/G3/G8 accepted**; G4/G5/G6/G7/G9/G10 open. G7-10 operating/hosted final acceptance still open. NEW LIVE DARK/NO-GO; Job #0001 reserved. No Cloudflare token/login, R2/paid subscription, SQL/photo export, Stripe event, Worker deployment, branch merge, route/Access/DNS change or LIVE release.
