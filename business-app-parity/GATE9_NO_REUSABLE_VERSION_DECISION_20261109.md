# FIRE Business App — Gate 9: no reusable inactive TEST Worker version

**Recorded:** November 9, 2026. **Evidence:** owner-run, real Acer Wrangler/Node read-only inventory of the existing TEST Worker; exact frozen classifier in draft PR217 at commit `5905673d53c1f280b502474b8a6fb8361be3f4bd`.

**Authority:** evidence and engineering decision only. This file does not authorize uploading or deploying, staging data, changing routes, turning on Stripe, editing Cloudflare/Stripe configuration, migrating databases, sending messages, making payments/refunds, or modifying LIVE.

## What was proven

- Read-only inventory returned `READ_ONLY_GATE9_RECENT_VERSION_CLASSIFICATION=PASS` and `ACTIVE_CODE_ONLY_BASELINE=VERIFIED_100_PERCENT`.
- Nine inactive TEST Worker versions were individually checked. All nine returned `ASSETS=ABSENT LIMITED_BINDINGS=DIFFER SOURCE=UNVERIFIED USABLE_WITHOUT_REVIEW=NO`. **There are zero reusable full-app candidates in that recent inventory.**
- The sole serving TEST Worker is `fire-stripe-test-20261101`, 100%-serving immutable version `96e32262-fa33-4f04-a161-bee11f0353e2`, with its separate physical TEST D1 UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba`, `DB` binding, exactly four encrypted secret names, `FIRE_STRIPE_MODE=disabled`, no R2 and expected anonymous Cloudflare Access redirect, each independently verified by owner read-only screenshots. Its version's resources do not show static assets.
- A full Vinext/Vite build with assets was previously stopped by strict remote configuration parity when used against the existing *code-only* TEST Worker. The existing webhook-only, asset-free source experiment is **not** a complete full-app replacement: non-webhook routes return 404. Neither can be silently promoted.
- The connected Stripe sandbox's separate existing six-event webhook has been confirmed; no new duplicate endpoint or replay is needed. There is no fresh signed post-creation delivery/ledger reconciliation yet.

## Firm Gate 9 engineering decision

**No active or inactive TEST version should be deployed, promoted, or reused from this inventory.** Preserve the serving version and its 100% routing. Do not retry the earlier strict upload, disable `--strict`, omit the full app's static assets, assume D1 names are equivalent to physical UUIDs without immutable proof, or inherit secrets/bindings from an unpinned `latest` upload.

A future candidate must be **the full app** (not the route-only experiment) and prove all of the following **before** seeking owner permission for any remote write:

1. **Exact source and complete build:** immutable candidate Git commit; correct application entrypoint, UI static assets, owner Access, Checkout/refund, webhook, and all existing app routes; no substitutions that turn routes into 404.
2. **Actual provider upload contract:** a currently documented Cloudflare API or Wrangler path that can create an **inactive version with static assets** without immediate routing; prove the precise asset manifest/module requirements with offline fixtures and a benign local dry run. Do not invent an undocumented multipart request.
3. **Immutable binding inheritance:** exact predecessor version `96e32262-fa33-4f04-a161-bee11f0353e2`, not most-recent-uploaded version. Cloudflare's script-version endpoint permits `bindings_inherit=strict` but, per its API docs, can inherit from `latest` uploaded rather than the 100%-serving version and **does not accept an explicit prior version ID**. The worker-version API variant documents explicit version inheritance; verify it is available to this Worker and that its assets semantics match before choosing it.
4. **Fail-closed binding identity:** TEST only; D1 exactly `dba421ba-fc66-4cf8-9c31-51616f8249ba` as `DB`, zero R2, four encrypted secret bindings *by name* with values never accessed, owner Cloudflare Access preserved, Stripe explicitly disabled, no unintended environment or routes.
5. **Pre-upload provenance and route tests:** isolated source CI, synthetic HMAC-negative controls, static asset parity and expected route availability, no D1/Stripe/remote writes, no implicit Stripe activation. Confirm known former version remains reachable.
6. **Separate owner approval:** exact new immutable source, code/assets upload target, active serving predecessor, expected artifacts, and explicit statement of no traffic/Stripe/D1/Access/LIVE writes. After any authorized inactive upload, independently verify **new version only** is inactive and all immutably bound resources and code/asset provenance match. Traffic activation requires an additional distinct approval, and Gate 9 still requires genuine signed TEST Stripe delivery and exact-cent ledger/refund reconciliation.

**Alternative:** stage the complete assets-enabled app on a *new independently isolated Worker*, with new version identity/Access/bindings/separate TEST D1 and migration evidence. This changes the architecture and has added provisioning, webhook and permission requirements; it requires a fresh explicit decision, and the current webhook must not be repointed or duplicated automatically.

### Primary Cloudflare documentation

- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
- https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/

## Release position

Gate 9 **OPEN**. This is an inactive-version reuse no-go, not a claim that a safe new upload method has already been engineered. 4/10 formal production gates accepted (Gates 1–3 and QA-only Gate 8); all LIVE/Stripe/financial changes remain **NO-GO**. No additional owner Acer command is needed merely to reconfirm the nine unusable versions.
