# Synthetic demo visible recovery and first installation retry

Base: d6b62600e9e49ad7d95a55ee6b9a8cd8b96d9f24. Remote lookup initially disconnected; one retry succeeded and matched the checkpoint. Official release readiness remains 3/10 (30%). Development-only changes, synthetic records only.

## Completed

The cached HTML owns a small dynamic-import bootstrap, so recovery instructions still work if demo.js or one of its imported modules is missing. Unlock/edit fieldsets and the lock control start disabled and are enabled only after successful module initialization. Import failure leaves controls disabled, hides the customer section, clears displayed customer/phrase values and shows a generic visible recovery alert. The retry button explicitly reloads the same URL; it does not delete databases, caches or records, replay writes, or automatically synchronize anything. The server now serves this relative-import HTML without rewriting a script src attribute.

The demo's registration-failure path also shows first-install retry instructions without claiming offline readiness. A synthetic vault can still be used online when shell installation fails, and retry preserves its saved customer. Existing 48px controls and mobile width behavior remain; fieldsets have zero border/margin/padding to preserve the successful-screen layout. No application viewport, scrolling, navigation, financial behavior, vault, schema or backup/restore code changed. The worker continues caching exactly five static assets, excluding APIs, customer responses and Stripe endpoints.

## Verification

All three isolated candidates passed 138/138 native Chromium checks: 11 new visible-recovery checks, 11 shell-update/recovery checks, 11 full cold-launch checks and 13 existing screen checks per target. First installation was forced to fail on the second native cache write, before any active worker existed; its incomplete cache was removed, no controller was active, and a visible retry was available. A saved encrypted synthetic customer remained at revision 2 after successful first-install retry. Missing demo.js and vault.js were each tested after offline reload: controls stayed locked, instructions remained visible, offline retries preserved exact encrypted object-store snapshots, and online retries repaired the modules and recovered the unchanged customer.

Actual browser process cold restart passed twice per candidate with the original URL, persistent Chromium profile, network disabled before navigation and localhost server stopped. Existing worker lifecycle, interrupted saves, locking during encryption, cross-tab revocation and ambiguous-write receipt recovery checks passed. Background/idle events are simulated. TypeScript and builds passed 3/3, standalone strict demo compilation passed, and local Doomsday build bindings verified. Shared parity checks cover 122 application files and eight identical demo/harness hashes. No failing final checks. Build output contains existing proxy/plugin timing warnings and Doomsday static route-classification caveats, not build failures.

## Limits and next batch

This remains a localhost-only synthetic demonstration; it is not a shareable iPhone installation or a full Business App offline release. iPhone/Safari/Home Screen behavior, actual storage eviction/quota exhaustion, abrupt OS crashes and clean-device recovery remain unverified. Real customer records stay inactive. The original whole-app scrolling shake remains unresolved. Existing encrypted backup/restore source is unchanged; its complete prior suite was not rerun for this UI-only batch.

Next bounded task: prepare isolated synthetic-only PWA manifest/icons and local packaging, then write a concrete iPhone installation/airplane-mode test plan. Do not deploy or activate real records. No production databases, migrations, Stripe actions, paid services or deployments were used; existing production releases remain unchanged.
