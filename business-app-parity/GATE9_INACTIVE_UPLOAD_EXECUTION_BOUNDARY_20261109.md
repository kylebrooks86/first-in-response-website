## November 9 local / November 10 UTC: private owner read-only execution bridge

The Work browser still redirects to Cloudflare Sign in. Do not repeat the rejected login or ask the owner for the already supplied active version / D1 / secret names again.

New owner_gate9_private_readonly.mjs uses only the pinned READ-ONLY API factory. It checks the reviewed Git source and refuses tracked helper changes; privately captures existing Wrangler auth using the documented fixed auth token --json command; only supports existing OAuth/API bearer authentication; never prints its stdout/stderr, stores a token file, asks for a token in chat, logs in, or grants permissions. It performs exactly the two provider GETs required by readState and prints only source/Worker/version/D1/mode/Access/secret-name verification. It does not read D1 rows/schema, invoke an upload transport, enable Stripe or create a version. Wrangler may refresh its existing OAuth credential according to its normal authentication behavior. This is not a new authentication grant.

Run ONLY from the reviewed source in the EXISTING C:\\Users\\Kyleb\\FIREQA-PR172 worktree, after a safe fetch/clean-tracked-files check/detached update. The command shape is:
node business-app-parity/cloudflare-launch/stripe-test-worker/owner_gate9_private_readonly.mjs --reviewed-source EXACT_REVIEWED_COMMIT_SHA
Replace the placeholder with the exact newly committed and CI-verified SHA; no resets, git clean, forced checkouts or duplicate worktrees. Do not run wrangler auth token directly on-screen and do not paste its output. The helper's redacted receipt alone is safe to share. If auth or API access fails, preserve the redacted STOP code and do not automatically retry.

Confirmed provider-format defect corrected: both actual adapters incorrectly rejected success:true with errors:null, which Cloudflare's direct-upload documentation uses in its valid registration example. They now accept omitted/null/empty-array errors only, while still rejecting nonempty or malformed errors and unsuccessful/status failures. New local affected coverage: 19/19 PASS (9 read-only adapter + 4 guarded-transport + 6 owner bridge tests). No real credentials, Cloudflare requests or Stripe writes in these tests. Windows command dispatch is simulated in this coverage; actual owner Acer execution remains unverified.

Source and candidateDigest necessarily change for this safety correction; previous source72 approval digest f2681d9535cd6a1d877eb3577f2d68ea657ee346aa5f85f405f69f0852af79e0 is historical, not the new upload approval digest. Obtain the new exact-head compiled digest from CI; no old digest reuse and no remote upload approval yet.

No further basic identity screenshot collection is needed. Essential next interaction is a private authenticated execution channel using the owner Acer's existing session or a genuinely authenticated Work browser. Subsequent asset registration/upload/one inactive version creation still need exact explicit approval, with predecessor96e32262-fa33-4f04-a161-bee11f0353e2 kept100%, Stripe disabled and TEST D1 unchanged. Gate9 remains OPEN; formal4/10 (40%), production NO-GO.

References:
https://developers.cloudflare.com/workers/wrangler/commands/general/#auth-token
https://developers.cloudflare.com/workers/static-assets/direct-upload/

# Gate 9 inactive full-app upload: guarded private HTTP code implemented; live execution still unauthorized

Reviewed starting source: 9a2f275c16049dc15865d8e16ba74ceab1f40936.
This document and the protocol coordinator do not authorize any remote write.
Existing compiled-app and QA passes remain scoped to their original source/artifact.

## Current exact boundaries

Worker: fire-stripe-test-20261101.
Required currently serving predecessor: 96e32262-fa33-4f04-a161-bee11f0353e2 at 100%.
Physical TEST D1: dba421ba-fc66-4cf8-9c31-51616f8249ba.
Keep Stripe disabled, the nine immutable inherited bindings, no R2, existing Access policies.
No existing inactive version is a suitable full-app substitute.

Owner later independently re-confirmed the exact serving version at 100% using the Deployments screenshot and supplied its full version ID. The TEST D1 UUID had already been verified. Those facts are retained without another screenshot request. An authenticated **Cloudflare REST API** GET against the private adapter is still not completed; browser authentication is not an API token.

## Newly prepared coordination

gate9_inactive_upload_flow.mjs has NO HTTP implementation, CLI, credential reader, or default adapter.
It coordinates a separately supplied authenticated adapter only after an externally reviewed owner-approval scope matches account, Worker, exact source SHA, candidate digest, predecessor, D1 and all three operations.
An approval-shaped JavaScript object is not proof of owner authorization; the invoking operator must obtain and record that separately.

Before every write, independently reread predecessor bindings and 100% serving traffic. Register manifest; validate every returned bucket hash; upload only requested hashes using the session JWT, never the account token; require provider 201 plus completion JWT (or cached-assets registration JWT) before creating a version. Use only the beta versions path with explicit ?deploy=false. Never call deployments, triggers, settings, secrets, database, payment, refund or replay endpoints.

Reject failed provider responses, expired local session budget, missing completion, drift, ambiguous results and mismatched post-upload readback. Never retry uncertain writes automatically. Reconcile actual provider inventory first; do not delete an uncertain uploaded version or attempt unapproved rollback.

**Final-bucket completion guard (verified at source head `cb7e7d2761360b0f98023fef42f9b5cd7048488c`):** A premature `201` or a completion JWT in a nonfinal asset bucket is rejected. If buckets are nonempty, the *final* upload must return `201` and a valid completion token before a Worker version-create request can run. The zero-bucket cached-assets case continues to use the registration JWT, as Cloudflare documents. The coordinator neither replays uncertain uploads nor treats earlier completion as proof the entire manifest arrived. Three additional negative fixtures PASS; total focused coordinator test cases 18/18 PASS in isolated Node22 CI. Provider acceptance remains unverified.

The coordinator returns only redacted identity evidence. It deliberately does not claim asset delivery or Gate 9 acceptance.

## Private HTTP adapter now exists — NOT authenticated or executed on Cloudflare

The previously missing application adapter is now implemented as isolated, non-CLI source:
- `gate9_cloudflare_readonly_adapter.mjs`: real Cloudflare **GET-only** endpoint paths, normalized physical TEST D1 via `database_id` or old `id`, exact 100% serving deployment verification, sanitized secret-name metadata and independent `GET .../versions/:id?include=modules` module-byte digest. Never emits credentials/raw response or supplies an HTTP client itself.
- `gate9_cloudflare_guarded_transport.mjs`: strict private transport limited to TEST asset-manifest registration, hash-named base64 multipart asset uploads with JWT auth, and one beta Worker version POST `?deploy=false`. No deployment POST or LIVE/Stripe/DB/Access write paths. Permission gate callback required before every individual POST, plus explicit immutable-inheritance checks; rejects unexpected hashes and changed files.
- `gate9_pinned_private_target.mjs`: exact known account ID `bfc00939cfb2f8dfd8581a7a7f5f1307`, Worker UUID `72f9cab371974bc8811da05f44976fa9`, Access app ID `09dbb414-997f-494f-85a5-a3a65a5a92ef`, dedicated TEST Worker name, predecessor and D1 identifiers, recovered from the retained Nov 2 FIRE Access workflow; prevents manual wrong-target substitutions before private transport construction.
- `gate9_compiled_candidate.mjs`: bridges the *actual compiled* TEST Worker modules+assets to the coordinator's `{sourceSha,manifest,versionBody}` approval structure; rejects unpinned source and removes only the fake JWT. It outputs **only source SHA, candidate digest, module/asset counts** to CI, never raw module code or a deployable JSON file.

**CI proof is synthetic/local only**, including a full fake Cloudflare server that verifies actual hash-named multipart bytes, per-POST private permission checks, exact active version, true module-byte GET comparison and no traffic change. This does NOT mean the provider accepted the API call.

**Execution remaining:** A privately authenticated Cloudflare connection with least-privileged Worker access and a separate, explicit owner approval for manifest registration, exact requested asset uploads and *one* inactive version creation. No such private credential or owner write consent has been supplied in this conversation. Do not load a token from GitHub Actions, reproduce a browser session cookie, or request/display secret values. Production/LIVE remains NO-GO.

The adapter implementation must enforce api.cloudflare.com origin, allowlisted exact account/Worker paths and methods, no redirects, bounded timeouts, private auth and redacted exceptions. It must retain all bytes privately and rehash exact compiled modules/client files against the approved candidate immediately before transmission. Hash-based upload descriptors are not file bytes and cannot be submitted as multipart themselves.

## Private operator prerequisites and fail-closed readback

Adapter request implementation must enforce api.cloudflare.com origin, allowlisted exact account/Worker paths and methods, no redirects, bounded timeouts, private auth and redacted exceptions. It must retain all bytes privately and rehash exact compiled modules/client files against the approved candidate immediately before transmission. Hash-based upload descriptors are not file bytes and cannot be submitted as multipart themselves.

Use the existing compiled envelope/module/asset validators before deriving candidateDigest; strip only the SYNTHETIC JWT placeholder from the approved version body. Do not alter or repurpose the fake-account/fake-JWT offline programs as a live uploader. The adapter must materialize real base64 multipart parts with correct MIME and serialize the real beta JSON body. Preserve _headers text/plain and run_worker_first:true.

readState must independently obtain immutable provider version metadata and current deployment percentages. readVersion must fetch provider version metadata and actual module bytes (where supported), calculate moduleDigest from those bytes, normalize expanded bindings, and preserve compatibility flags. moduleDigest is a LOCAL verification result, not a claimed Cloudflare response field. Never echo the outgoing request to satisfy readback. If exact module/asset readback is unavailable, stop without claiming byte parity.

An account dashboard session is not an API upload credential. No browser-cookie extraction or API-token values in chat/GitHub. Resolve an approved private execution channel before requesting write approval.

## Approval and acceptance sequence

1. Securely authenticate and complete fresh read-only predecessor, physical D1, config, required schema/journal, routes/Access, and retained rollback evidence. Reuse accepted evidence that has not changed.
2. Finish and review the authenticated adapter, pin source/build/module/client digests, inspect its allowlisted operations, and run only affected no-network tests.
3. Obtain separate owner approval for exactly: asset registration, requested asset uploads, one inactive version creation in the existing TEST Worker. No active traffic, mode, secret, binding, R2 or database changes.
4. After authorized writes, independent provider GETs must prove new full version ID, code/assets provenance, inherited bindings/config and old predecessor still 100%; new version absent from active traffic. Provider receipt alone does not prove runtime.
5. Test asset/runtime delivery only through an existing authorized protected version-preview/override path whose scope and potential application writes have been reviewed. Do not enable previews or bypass Access without separate approval. Zero active deployment traffic does not mean a preview cannot execute or touch bound D1.
6. Only after that acceptance, separately approve any TEST activation/API key/account pin/mode changes and synthetic record/checkout/signed event/refund/replay operations. No older paid sessions substitute for current signed delivery and D1 persistence.
7. Code rollback does not restore database, provider refund or photo state. Retain independent private backups and reconcile uncertain results before any retry.

## Verification scope

18 targeted offline tests cover authorization refusal, successful/cached protocols, failed upload, absent completion, unknown/duplicate hashes, expiry, provider errors, mid-flight traffic drift, uncertain result without replay, candidate mutation and failed independent readback.
These tests use a fake adapter and tokens only. No real provider acceptance, asset delivery, signed webhook, checkout, refund, ledger or idempotency result is claimed.

Formal status: 4/10 accepted (Gates 1–3 and synthetic QA Gate 8); Gate 9 OPEN; production NO-GO.

Official references:
- https://developers.cloudflare.com/workers/static-assets/direct-upload/
- https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/
