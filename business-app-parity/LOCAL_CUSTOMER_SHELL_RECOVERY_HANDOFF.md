# Synthetic shell update and recovery checkpoint

Base: b48913acfa783dc2dcf7655fb83f547a189b8d1a. Remote head matched before development and again before saving. Official release readiness remains 3/10 (30%). All changes are development-only.

## Completed change

The directory-scoped synthetic service worker now writes static cache entries sequentially. If a write fails, it deletes the incomplete candidate cache and rejects installation. The previous active worker and its complete cache retain their separate content-derived version. All static responses are still fetched, validated and buffered before the first cache write. No skipWaiting was introduced. Vault, backup/restore, shared application UI, navigation and payment source remain unchanged.

The localhost demo server gained a validated optional testRevision argument. This changes the worker/cache version for deterministic native update tests without modifying business records or production assets. Test faults are injected only by the new browser harness wrapping its own local server. They are not shipping runtime fault switches. The server still binds only 127.0.0.1 and serves only the synthetic demonstration.

## Native browser evidence

Three synchronized isolated candidates passed 105/105 checks: 11 shell recovery + 11 complete cold launch + 13 screen regressions per candidate. New shell tests exercise native worker lifecycle with two controlled clients. Download interruption and a Cache.prototype.put rejection after one successful native write leave the old shell usable offline, with the saved synthetic customer at revision 2. A valid replacement waits until all old clients close; activation removes only obsolete demo caches, retains unrelated caches and preserves encrypted customer retrieval. The updated worker serves the demo after the origin server stops. Missing vault.js returns an offline error without being cached; reconnection repairs it. An unmarked response is rejected rather than cached.

The existing full cold-launch sequence passed again on all three targets: two complete Chromium process restarts using the same persistent profile, network disabled before navigating to the original URL, origin server physically stopped, encrypted record unlock/edit/retrieval, interrupted-save preservation and missing cached HTML safety. Screen regressions retain cross-tab lock, lock during encryption, receipt verification after ambiguous committed saves, revision protection, and simulated background/idle locking. Full candidate TypeScript and builds passed 3/3. JavaScript syntax checks passed 3/3. Source parity covers 122 shared application files and seven identical demo/harness hashes; fresh Doomsday local build bindings were verified. See the evidence JSON and exact output log.

## Limits and next batch

Native cache-write rejection was injected, not real disk/quota exhaustion. Abrupt OS termination, cache deletion failure, browser eviction, initial-install failure without an older shell, Safari and iPhone Home Screen launch remain unverified. Missing JavaScript produces an explicit module-fetch error but does not yet provide a polished in-page recovery screen; add that next. This localhost-only demo is not presently available through a shareable iPhone installation URL. The full Business App is not yet offline, real customer records remain inactive, and the reported whole-app scrolling shake is unresolved. Encrypted backup/restore source is unchanged and its earlier full suite was not rerun.

Next bounded batch: visible missing-module recovery and first-install failure/retry tests, then synthetic-only installable PWA packaging and an iPhone test plan. Do not deploy, connect production databases, process Stripe actions or enable real records. Existing production releases and rollback copies remain untouched; additional spending is USD 0.
