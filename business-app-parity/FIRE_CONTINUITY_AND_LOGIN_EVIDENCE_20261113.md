## Nov 25 21:23 CST — four-target hosted script-level binding evidence and exact STAGING blocker

Owner Acer provided full sanitized `FIRE_G4_BINDING_NAMES_READ_ONLY_CAPTURE`: all four expected D1 identities match, zero wrong-target auth names, zero R2 and unreviewed binding types. QA both expected auth names present; STAGING session secret present, admin password hash absent; DR and NEW LIVE both expected auth names absent (remain dark). Follow-up owner screenshot of GET settings name/type projection confirms STAGING exactly `DB` (d1), `FIRE_SESSION_SECRET` and `STRIPE_SECRET_KEY` (secret_text). Stripe key mode/value NOT established; do not expose, delete or alter serving credentials. Provider reads only; no writes, no activation, no secret values output. Script-level metadata is not version-pinned or Access enforcement proof. Preserve existing serving version and consumed locks; no repeated binding checks. G4-04/G4-07 remain open; 57/95, 5/10 gates accepted. Next: reconcile exact local compiled candidate provenance and prepare fresh separately authorized inactive upload preserving DB/session and disabling Stripe for candidate only.

---

<!-- FIRE-G4-STAGING-ID-PHYSICAL-20261125 -->
## Nov 25 21:17 CST — owner Acer STAGING Cloudflare Worker ID/name physical proof PASS (no provider write)

Owner Acer read-only PowerShell screenshot SHA-256 `7c3bac40a217d871351916a5dfaa9c9f75057fdc62a0ea5754844b396fadeec7` confirms both downloaded helper hashes matched (`VERIFIED`), followed by actual `node owner_staging_beta_worker_identity_read_only.mjs --capture` output `FIRE_STAGING_BETA_WORKER_IDENTITY_GET_PASS`. Cloudflare returned Worker `fire-app-independent-staging`, ID `34478b20ffef45138ec3b41fa578ec5b`. Name/ID cross-check, account mapping, supported beta Worker name lookup and direct provider readback each `true`, exactly **two GET requests**; no provider writes, login, upload or activation. This **closes the unique physical Worker-ID mapping subproof** previously pending in the 21:xx engineering checkpoint; do not ask for another mapping screenshot or retry this GET.

Other tool booleans are `false` because the narrow script did not inspect them: serving-version unchanged, bytes/MIME provenance, Access policy, D1 migration parity, payment disabled mode, private admin hash, Gate4 acceptance. **G4-04/G4-07 remain OPEN** and serving STAGING is unchanged by this GET. Original STAGING upload attempt locks remain consumed; no POST/no retry/no lock reset. Remaining actual hosted work still requires review of the package/source/MIME and 22/25 migration gap, narrow new approval for any future physical upload/migration and 0%-traffic/rollback protection. [Permanent G4 evidence](evidence/FIRE_G4_STAGING_BETA_WORKER_ID_GET_ONLY_20261125.md). Original **57/95 accepted, 38 open; 5/10 formal gates G1/G2/G3/G7/G8**; LIVE NO-GO, Job #0001 unused. No paid R2/Cloudflare, Stripe, D1, Access, deploy, Git merge or production change.

---

<!-- FIRE-G4-STAGING-ID-MAPPING-20261125 -->
## Nov 25 G4 STAGING actual development — safe beta Worker ID/name GET-only checker

PR282 new source `owner_staging_beta_worker_identity_read_only.mjs` and injected mock regressions, wired into existing CI, address previously unverified Cloudflare beta `worker_id` mapping by GET by name and second GET by returned ID. New documented helper [exact evidence](evidence/FIRE_G4_STAGING_BETA_WORKER_ID_GET_ONLY_20261125.md) is default-offline, private Windows existing-token opt-in only; no login, provider writes, preview/route, backup, D1, Stripe, R2 or payment action. The old STAGING serving deployment/100% version and both spent upload locks remain preserved. Physical name-ID proof not yet captured; module MIME/source provenance and 22/25 physical migrations remain separate. Original **G4-04/G4-07 OPEN**, **57/95 original accepted, 38 open, 5/10 formal gates G1/G2/G3/G7/G8**; NEW LIVE dark, Job #0001 unissued. Exact changed-source targeted CI PASSED: [run #45747389390](https://github.com/kylebrooks86/first-in-response-website/actions/runs/45747389390) 2/2 jobs SUCCESS including the new mock identity mapping step; no physical provider ID captured.

---

<!-- FIRE-G9-BOUNDED-REFUSAL-20261125 -->
## CURRENT Nov 25 G9 safety checkpoint — refusal parser fixed in PR282 source only

As an incremental source safety improvement after actual owner one-shot G9 POST refusal (consumed, no-repeat), the existing G9 uploader now consumes a **bounded 64 KiB streamed provider error response** and reports only sanitized HTTP status and up to five numeric error codes. Invalid, truncated, missing or oversized bodies yield UNKNOWN without exposing provider body, token, or request. Commits [7ca36e3](https://github.com/kylebrooks86/first-in-response-website/commit/7ca36e3147e33720194d07d6046aca4dac473476) (real uploader code) and [b414bdb](https://github.com/kylebrooks86/first-in-response-website/commit/b414bdba4126fc3a14385deeb68835fd452ef9c9) (native offline regression). New exact-SHA CI pending when this addendum was written. This does NOT reconstruct the historic failure or authorize another attempt. Prior Nov25 six inactive version GET classification returned no attributable byte-identical candidate; preserve as final accepted no-repeat diagnostic. No source deployment. Original release tracker remains **57/95**, formal gates **5/10 accepted G1/G2/G3/G7/G8**; STAGING and TEST activation remain gated. No paid Cloudflare/R2, Worker/D1/Stripe changes, merge, or LIVE cutover.

---

