# Batch 2 — candidate-only changes

Parent GitHub candidate: da9a8ff. Work remains sole writer; QC read-only. No production/deployed migrations, auth changes, resources, refunds, or payments were made.

Confirmed the existing candidates already contain shared refund/tip controls and Weather/Insights; do not reimplement those features. Deployed differences remain until an approved release.

New shared changes: National Weather Service Tulsa forecast via owner-authorized /api/weather, upstream hostname allowlist and timeout, malformed/expired-data rejection, explicit unknown values, forecast labeling and update time, refresh on focus/visibility and cancellation cleanup. NWS documentation says free for any purpose; Open-Meteo free API is non-commercial. No service activated. Added photo no-storage guards to download/delete so no metadata is queried/deleted when the bucket is absent.

Read-only Stripe connector confirms FIRE sandbox livemode=false. Existing Doomsday checkout charged 48400 cents, metadata principal44000/tip4400; successful refund10000. Classic webhook inventory returns one enabled sandbox endpoint, targeting LIVE /api/payments/webhook, checkout events only, no refund events. Checkout completed event has pending_webhooks=1. No endpoint changed or event resent. Event destinations v2 and current app-ledger reconciliation still need verification; endpoint inventory is not proof that all delivery paths are absent.

LIVE Site version61 and refund staging version3 unchanged. Independent /api/app-version HTTP check returned403. Cloudflare browser opened a blank page after an unexpectedly long wait; no authenticated dashboard/schema obtained. Not classified as bot detection. Read-only schema SQL prepared for authenticated inspection; do not execute migrations or alter journals.

Photos: independent has no verified object storage. Metadata backup is not file backup or recovery. No free storage provisioned or LIVE bucket shared. Login: current adapter still uses SHA256 credential verifier and signed cookie; this is not a tested migration from deployed shortPIN and cannot be released as an auth transition without recovery approval.

Local tests do not certify deployed parity, iPhone rendering, NWS network availability in Cloudflare, or Stripe end-to-end integration. Candidate requires isolated staging release plan plus exact target/rollback verification before deployment. Production readiness stays blocked.

Verification: 21/21 shared suite runs across three candidates, plus LIVE Owner Account, independent candidate auth, and parity-gate tests =24/24. TypeScript3/3 and production build3/3 passed. Initial TypeScript unknown JSON response error was corrected before commit. Gate now checks hooks/vendor as well as application folders, 118/118 identical. NWS points lookup HTTP200; full forecast network attempt failed, so Cloudflare forecast availability remains unverified. No iPhone rendering claimed.

Local source commits: {"parity-live-candidate": "c9d0e61741aaed49e4df756782db4e1932a962e3", "parity-dr-candidate": "879df629c830ff1e95f2dbdeaf21b974116dda3f", "parity-staging-candidate": "f604bdc05eeb4005e4bfa69c52ab40b5c8eaec25"}

Required owner intervention to unblock remote work: authenticated read-only Cloudflare Worker/D1 access or results from READ_ONLY_CLOUDFLARE_SCHEMA.sql (schemas/journal, no customer rows). Stage endpoint configuration must be reviewed against the actual sandbox before any changes; current classic endpoint points to LIVE and must not be altered or replayed. No production approval requested.
