# FIRE Gate 9 — strict Worker configuration conflict: current decision and supported alternatives

**Nov 3, 2026. SOURCE/RESEARCH ONLY. Not an approved deployment plan.** Existing app is NOT being rebuilt. Existing isolated TEST Worker is `fire-stripe-test-20261101`. The protected current serving version remains `96e32262-fa33-4f04-a161-bee11f0353e2` at 100% in the owner's last authenticated read-only receipt. Formal Gate 9 OPEN; production 3/10 accepted and NO-GO. No additional upload attempt is authorized.

## Proven Cloudflare facts — owner Acer authenticated metadata

- The current immutable Worker version's `resources` exposes `script`, `script_runtime`, `bindings` and **no** `assets` / `static_assets` section. Four `secret_text` names exist, and the Worker D1 binding `DB` has physical UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba`. `FIRE_STRIPE_MODE=disabled` was already verified separately in the same immutable version; secret values were never printed.
- `wrangler.cmd d1 info fire-stripe-test-db-20261101 --json` independently confirmed `uuid=dba421ba-fc66-4cf8-9c31-51616f8249ba`, `name=fire-stripe-test-db-20261101`, 22 tables, 0 writes in the prior 24h, region ENAM. This proves D1 *identity*, not a schema migration or Stripe ledger.
- Source test `prepare-stripe-test-manifest.test.mjs` explicitly requires carrying Vite client `assets:{directory:'../client',binding:'ASSETS'}` into the TEST build, and the source `shared/vite.config.ts` uses the Cloudflare Vite plugin and Vinext. **Do not remove assets from the full app bundle just to make Wrangler stop complaining.** Its presence may be necessary to load the application; this is not a webhook-only bundle.
- The owner's last one-off approved `wrangler.cmd versions upload --config <review> --keep-vars --strict` aborted after both local dry runs and explicit owner authorization, because the local candidate introduced `assets: {}` and included `d1_databases[].database_name` relative to the dashboard's remote configuration. Wrangler correctly said uploading would override remote configuration, and refused under `--strict`. Read-only versions list after the error showed no new version. No activation or rollout occurred.
- Wrangler version `4.151.0` on Acer can parse this config in `deploy --dry-run`, but **dry-run does not compare the live Worker's remote binding/asset model**. Cloudflare documents version snapshots including code, assets and bindings. Wrangler's D1 config requires *both* name and ID. The dashboard's D1 `resources.bindings` represents the DB by ID only. The difference does not imply a wrong physical DB.

## Concrete source fix made this turn

The old owner inactive uploader had no immutable remote-assets parity gate before its final prompt. The draft `Assert-RemoteAssetsNotChanged` now reads the **actual prior immutable version metadata** via read-only Wrangler `versions view --json` and refuses any introduced/removal/unknown asset representation **BEFORE** user confirmation. Against the verified current Vite bundle, it must stop, not attempt another doomed upload. This is an intentional fail-closed outcome. It does not remove `--strict`, bypass D1 drift or authorize any host change. CI synthetic tests cover matching no-assets minimal candidates, a new Vite asset block, existing remote assets, invalid version/schema and malformed JSON; assert ordering before approval.

## Provider-documented alternatives to investigate, not run

1. **Code-only webhook candidate that does not require Vite static assets.** This would have to compile the actual existing HMAC-first TEST webhook and its required modules as a self-contained Worker, not a different hand-written payments implementation. It must preserve all owner Access/auth, sandbox-only guards, disabled-mode 400/503 outcomes, four secret-name references and exact D1 physical binding. Prove *source equivalence and no-assets bundle* in CI and resolve the separate remote D1 name metadata discrepancy before any attempt. This is a source packaging change, not permission to substitute a weaker script.
2. **Cloudflare Worker Versions API with explicit binding inheritance.** Cloudflare publicly documents an inactive-only version upload endpoint and `inherit` binding types, with `bindings_inherit=strict`. However, the ordinary `/workers/scripts/{script_name}/versions` endpoint only supports `version_id=latest` for binding inheritance, which can be **different from the active serving version**; only a different Worker Versions endpoint supports an explicit prior version ID. Using either requires a provider-authenticated API contract review and conservative evidence of binding/asset inheritance, exact version pin and all tenant permissions. **Do not request Cloudflare tokens from the user in chat or implement an undocumented multipart upload.** Source: https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
3. **Cloudflare dashboard's Save as inactive version** is an officially documented workflow (Edit code → down-arrow next to Deploy → Save). It does not by itself prove that saving this multi-module Vinext build would preserve bindings/assets without changes; must separately inspect its workflow, exact code bundle, owner Access and resulting version before seeking bounded approval. Source: https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/
4. **New separately isolated asset-enabled TEST Worker** might avoid changing the current one, but would create a new route/identity and require new Access, Stripe webhook routing, storage, secrets, expense and separate owner authorization. Do not default to this. **Never** repoint the existing five-event webhook or touch LIVE/QA/DR without approval.

## What is NOT an acceptable workaround

- Removing `--strict` and clicking through remote overwrite warnings.
- Removing `assets` from the *full app* config without a built-and-tested webhook-only code artifact.
- Removing `database_name` from the Wrangler D1 config to suppress a diff (provider docs require it).
- Assuming a matching D1 UUID alone proves the complete remote resource model is preserved.
- Supplying/creating Stripe secrets or API keys, applying D1 migrations, reusing a consumed one-shot approval, or changing traffic.
- Repeated owner Acer commands when the root cause and available metadata are already known.

## Release priorities independent of Gate 9

Gate 4: authenticated Sites LIVE/refund-staging physical DB UUID + serving artifact/provider identity. Gate 5: exact bound LIVE D1 journal and `payment_refunds` *after* Gate 4 identity. Gate 6: owner/nonowner/cross-customer hosted isolation. Gate 7: bound private backup + photo custody and rollback. Gate 8: targeted changed-controls iPhone Safari/PWA acceptance. Gate 10: final independent database backups, release freeze and explicit owner seal. These do not require repeatedly exercising the TEST upload.

**No source-only test changes the formal gate count: 3/10; production NO-GO.**
