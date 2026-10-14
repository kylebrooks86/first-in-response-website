# Read-only hosting evidence request for Gate 4

The owner connection already works. Do not repeat Google/Cloudflare sign-in, clear storage, reset apps or change bindings. LIVE/refund staging are hosted through ChatGPT Sites; their underlying resources must not be assumed to belong to the owner's personal Cloudflare account.

## Message for ChatGPT Sites hosting support

Please provide read-only deployment/database identity evidence for my two existing FIRE Business App Sites:

- LIVE: https://fire-app.kylebrooks8605.chatgpt.site
  Project: `appgprj_6aaf416f82c88191a292fa2e13a9ea61`
  Successful deployment: `appgdep_6ac6f067e2548191aaf38c28d25c54f5`
  Saved version: 61. Saved source commit: `896b5e4125cb89da729993d1f37127e3b930c79d`.
  Current `/api/app-version` response: `105`.
- Refund staging: https://fire-live-refund-staging.kylebrooks8605.chatgpt.site
  Project: `appgprj_6ac7e8e358dc81918d0a47c4034c4a41`
  Successful deployment: `appgdep_6ac7f3e8903481919a5883a2750ccbb8`
  Saved version: 3. Saved source commit: `f7ed28a5d13ada738f5663e4f55a45c5d794c21e`.
  Current `/api/app-version` response: `refund-staging-ebc670f`.

I need each deployment's actual immutable Cloudflare D1 database identifier bound as `DB`, confirmation that those databases are distinct, and the provider's mapping from deployed Worker artifact/version to the saved source commit. If internal resource UUIDs cannot be exposed, please provide an authoritative immutable resource mapping/attestation sufficient to verify the databases are separate.

Please supply metadata only. Do not deploy, migrate, rebind, modify or inspect customer/payment records. Do not include secret values, credentials or API tokens. This is a read-only release-safety review.

## Remaining independent Doomsday evidence

Existing owner evidence already identifies DB `fire-app-staging-db` / `afb2c05a-d794-4a9a-b580-924ce01c26ad`, Worker `fire-app-independent-staging`, and captured Worker version `61fa32a3-3461-469d-9245-a9df6dd3f036`. Do not request those same screenshots again. Complete deployed artifact/source linkage remains a separate pending check; Sites support is not responsible for the independent Worker.

## Newly verified in this batch

Sites reports the owner role for both projects and the same successful saved deployments. Supported Sites service access reached both existing `/api/app-version` endpoints with HTTP 200. The initial unauthenticated requests returned HTTP 403. The service credential was used only for its exact Site and was never stored in this repository or included in evidence.

Successful version responses improve runtime evidence but do not establish immutable source/artifact seals or physical D1 isolation. Gate 4 remains pending. Official readiness stays 30% (3/10 gates). No support message has been sent by the agent.
