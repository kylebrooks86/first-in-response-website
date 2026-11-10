# Gate 9 inactive full-app upload: prepared protocol, execution blocked

Reviewed starting source: 9a2f275c16049dc15865d8e16ba74ceab1f40936.
This document and the protocol coordinator do not authorize any remote write.
Existing compiled-app and QA passes remain scoped to their original source/artifact.

## Current exact boundaries

Worker: fire-stripe-test-20261101.
Required currently serving predecessor: 96e32262-fa33-4f04-a161-bee11f0353e2 at 100%.
Physical TEST D1: dba421ba-fc66-4cf8-9c31-51616f8249ba.
Keep Stripe disabled, the nine immutable inherited bindings, no R2, existing Access policies.
No existing inactive version is a suitable full-app substitute.

The browser preflight in this session reached Cloudflare's sign-in page. Neither a fresh serving-version nor database-binding read was possible. Owner-supplied historical mapping is retained, not relabeled as fresh API evidence.

## Newly prepared coordination

gate9_inactive_upload_flow.mjs has NO HTTP implementation, CLI, credential reader, or default adapter.
It coordinates a separately supplied authenticated adapter only after an externally reviewed owner-approval scope matches account, Worker, exact source SHA, candidate digest, predecessor, D1 and all three operations.
An approval-shaped JavaScript object is not proof of owner authorization; the invoking operator must obtain and record that separately.

Before every write, independently reread predecessor bindings and 100% serving traffic. Register manifest; validate every returned bucket hash; upload only requested hashes using the session JWT, never the account token; require provider 201 plus completion JWT (or cached-assets registration JWT) before creating a version. Use only the beta versions path with explicit ?deploy=false. Never call deployments, triggers, settings, secrets, database, payment, refund or replay endpoints.

Reject failed provider responses, expired local session budget, missing completion, drift, ambiguous results and mismatched post-upload readback. Never retry uncertain writes automatically. Reconcile actual provider inventory first; do not delete an uncertain uploaded version or attempt unapproved rollback.

The coordinator returns only redacted identity evidence. It deliberately does not claim asset delivery or Gate 9 acceptance.

## Missing authenticated adapter: do not mistake this for an executable uploader

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

15 new offline tests cover authorization refusal, successful/cached protocols, failed upload, absent completion, unknown/duplicate hashes, expiry, provider errors, mid-flight traffic drift, uncertain result without replay, candidate mutation and failed independent readback.
These tests use a fake adapter and tokens only. No real provider acceptance, asset delivery, signed webhook, checkout, refund, ledger or idempotency result is claimed.

Formal status: 4/10 accepted (Gates 1–3 and synthetic QA Gate 8); Gate 9 OPEN; production NO-GO.

Official references:
- https://developers.cloudflare.com/workers/static-assets/direct-upload/
- https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/
