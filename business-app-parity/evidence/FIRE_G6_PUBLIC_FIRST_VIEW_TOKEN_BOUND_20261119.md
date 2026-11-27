# FIRE G6 — Public estimate/invoice first-view token isolation and false-alert prevention (2026-11-19)

**Authority and scope:** Existing unmerged Draft [PR #270](https://github.com/kylebrooks86/first-in-response-website/pull/270); changed-source SHA [`18b67b7264432f8451f7e740ade9d21b5334b6ac`](https://github.com/kylebrooks86/first-in-response-website/commit/18b67b7264432f8451f7e740ade9d21b5334b6ac), **verified with source/SQLite/isolated compiled QA Worker only**, no Cloudflare/Stripe/hosted transaction.

## Real defect and correction

Both public estimate and invoice views originally fetched a customer share token in the page and then wrote first-view metadata and `*_viewed` notifications by document/estimate ID **without rechecking the current bearer token or the exact customer relationship inside the SQL write**. An owner-revoked token, re-linked invoice or concurrent owner change after the initial page SELECT could mark an invoice or quote as viewed and produce misleading notifications. The separately synthetic-gated revised-deposit agreement's view/alert had the same missing token comparison.

Shared first-view helper `shared/lib/public-document-first-view.mjs` now compares document ID, customer ID, current share token and actual linked customer/estimate relationships atomically in the D1 UPDATE **and** first-view notification INSERT SELECT, followed by independent token-bound readback. Already-viewed current links remain usable; revoked/mismatched/unverifiable first-view links fail closed without a fabricated viewed event or duplicate notification. An interrupted D1 transaction acknowledgment is handled by readback, never by automatically repeating the write.

- [Shared helper `9b889ee`](https://github.com/kylebrooks86/first-in-response-website/commit/9b889eea3212224589786e3ed756b38283892ae9)
- [Actual public invoice page `1b93941`](https://github.com/kylebrooks86/first-in-response-website/commit/1b9394112d2aada7ef96bf91b4657e345e0f29ce)
- [Actual public estimate page `9df1091`](https://github.com/kylebrooks86/first-in-response-website/commit/9df1091d306d866bfae867f666d3e383d3e54db1)
- [Separate revised-deposit first-view SQL token/customer CAS `7344ae4`](https://github.com/kylebrooks86/first-in-response-website/commit/7344ae4f3f3311bb44d3b1f67fc7ca2aa1902f23). Existing synthetic-only revised-terms hold and 50% legacy-agreement suppression remain.
- [Actual native SQLite new regression `0cf3a33`](https://github.com/kylebrooks86/first-in-response-website/commit/0cf3a3370440b0642def0e72f596dcb6466e1f11), [revised first-view source assertions `2a064c8`](https://github.com/kylebrooks86/first-in-response-website/commit/2a064c8357262d10b88ef92a4b28ec1925d2839a), [physical `total_changes()` regression `7e8e6d9`](https://github.com/kylebrooks86/first-in-response-website/commit/7e8e6d99d567104f907be84a9e1b368dd0c3e6be), [actual immutable audit fixture correction `181ba07`](https://github.com/kylebrooks86/first-in-response-website/commit/181ba074ac36ae9b3b94307e6b94c7faa447c2e5).
- [CI suite wired `1a88382`](https://github.com/kylebrooks86/first-in-response-website/commit/1a883820aad1731f2885b42d3678241eb68ce416) into native QA/browser. [Existing public document guard updated to execute new real helper, not stale in-page SQL `96f5525`](https://github.com/kylebrooks86/first-in-response-website/commit/96f552542626bd4872b5169332e24de7d55a2ff0), [bound-statement fixture corrected `18b67b7`](https://github.com/kylebrooks86/first-in-response-website/commit/18b67b7264432f8451f7e740ade9d21b5334b6ac). Existing acceptance/notification SQL test remained live rather than bypassed.

## Exact-source verification, source only

**Final immutable tested SHA `18b67b7264432f8451f7e740ade9d21b5334b6ac`:**
- [FIRE STAGING/QA six-job run #44614420403](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44614420403) **COMPLETED SUCCESS 6/6 independent jobs**: compiled QA Worker/browser Customer return and restart, changed deposit/native SQL, isolated staging source build, synthetic D1 migrations, fake TEST Stripe event contract and Windows negative checks.
- Real GitHub log for step `Verify declined estimate never shows collectible deposit; test save/readback and geometry` (job `135879210029`): **PASS 64/64 public estimate/invoice real first-view helper, native SQLite token-revocation, customer ownership, false ACK, lost ACK and no duplicate notifications**. Also retained the native deposit-policy positive/negative and synthetic UI browser tests.
- The independently compiled QA Worker job `135879210370` verified the **actual public document guard/notification tests COMPLETED SUCCESS**, including original acceptance idempotency and saved financial balance guards; no stale static SQL assertion remained.
- [Public website and calculator preservation #44614419929](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44614419929), [website verifier #44614420243](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44614420243), and [Gate9 full-app LOCAL build #44614420400](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44614420400) all **SUCCESS**.
- **27/27 GitHub exact-code checks SUCCESS**, zero failures/pending. Earlier interim CI exposed (1) test fixture missing required immutable `deposit_policy_events.confirmation_id`; (2) preexisting static test expecting removed inline SQL. Both were corrected without weakening application guards. Only final exact SHA is called 6/6 PASS.

## Release boundary — no false gate closure

This verifies actual source and disposable synthetic SQLite, **not** provider-hosted QA/STAGING/DR/NEW LIVE identity, Access protection, real nonowner token denial, Stripe signed TEST events or physical backup/restore. **50/95 checklist accepted; 45 open; G1/G2/G3/G8 formally accepted (4/10), G4/G5/G6/G7/G9/G10 OPEN**. NEW LIVE DARK/NO-GO, real Job #0001 untouched.

No Git merge, hosted deployment/migration, Cloudflare upgrade/R2/route/Access, provider Stripe/payment/communication, real customer/photo data, or owner Acer/iPhone retest. Historical accepted evidence remains in place.
