# Offline-first Business App implementation handoff — 2026-10-09

## Owner goal and current boundary

The installed iPhone Home Screen app should support everyday business work in airplane mode while preserving the original app's smoothness and all newer capabilities. Internet-dependent services may remain online. Additional spending must remain USD 0. No deployment, migration, remote database write, Stripe action or paid provisioning is authorized by this plan.

This is a source audit and implementation specification, not delivered offline functionality. Current official production readiness remains 3/10 (30%), NOT READY. Preserve the ten-gate denominator; add offline acceptance requirements to applicable storage, mobile, authentication, integration and recovery gates rather than counting this document as a new passed gate.

The latest verified runtime checkpoint is 53984f88cf2152cfc52d727adb82e810b3279927. Its section-navigation fix remains preserved. App-wide shaking is still unconfirmed and requires matching-mode iPhone investigation. Offline architecture must not introduce viewport resize loops, scroll listeners or broad CSS changes.

## Confirmed architectural gap

The shared Home route is force-dynamic, requires server authentication and reads Dashboard data from D1 before rendering. The standalone manifest supports Home Screen presentation; the shared app has no service-worker registration/cache implementation or IndexedDB record store. Dashboard localStorage is used for theme preferences, not business records. Dashboard reads and writes business data through server APIs. Merely caching the current authenticated page would not supply local CRUD or safe recovery.

Target-specific authentication adapters still need independent review; these findings concern the checked shared candidate, not an independently observed deployed offline test. The calculator's existing offline code is outside Business App scope and is not evidence that the Business App works offline.

## Capability contract

| Workflow | Required offline behavior | Online boundary / safeguard |
| --- | --- | --- |
| Dashboard, navigation, calculators and pricing | Cold-launch installed shell; calculate from verified local records and bundled rules; show data freshness | Never replace unavailable data with misleading zero totals |
| Customers, addresses, notes, tasks, expenses, scheduling | Read/create/edit local records with durable local save status | Sync with explicit conflict handling; external property/map links require internet |
| Estimates and draft invoices | Create/edit, calculate, retain drafts and local document previews | Share links, email/SMS delivery and global invoice-number assignment require reconciliation; use clearly provisional offline identifiers |
| Issued invoices, payment history and refunds | View last verified snapshot and status/freshness | Financial amendments remain drafts until online validation; never infer card success or refund success from an offline action |
| Templates and job reports | Bundled defaults plus local saved edits/reports | Version/conflict checks before merging with existing server records |
| Photos | Capture/import and read local photo bytes, subject to storage capacity | Metadata alone is insufficient; keep Blob bytes and include them in exported recovery archives |
| Manual payment bookkeeping | If implemented, save an explicit pending owner record with stable operation ID | Do not label it reconciled until server acknowledgement; preserve fee/tip/principal separation |
| Stripe checkout/refunds/webhooks | Explain that connection is required; show last known state | Never queue automatic charges/refunds or call Stripe during offline testing |
| Google Earth, Zillow, maps/navigation, external payment links and other connected services | Clear connection-required state with local work retained | Do not fake success or silently launch paid operations |
| Records and photo backup/restore | Owner-controlled export/import and verification without server access | Reuse existing relationship/refund validation; older verified backups remain compatible |

## Implementation order and acceptance checkpoints

1. **First bounded code batch: isolated local customer repository, no runtime activation.** Introduce a browser-compatible IndexedDB adapter under shared lib with an explicit database namespace containing account and target identity. Use stable local UUIDs, schema versioning and transaction completion acknowledgement. Keep record changes and an outbox entry in one transaction. Implement only synthetic customer create/read/update plus export in this first unit. No service worker, API interception, payment outbox, server writes or deployed behavior changes. Execute tests against an actual IndexedDB implementation when a free available browser permits; mocks alone must remain labeled as mocks. Acceptance: synthetic records survive reopening; abort leaves no partial record/outbox; capacity/error paths preserve the previous record; different namespaces cannot read each other's records; duplicate operation IDs are idempotent. Do not declare airplane-mode support from this unit.
2. **Independent offline shell and local unlock.** Bundle required assets and a client shell that can cold-launch without server rendering or ChatGPT. Retain online authorization for connected operations; specify secure local unlock, account isolation, sign-out/erase choices and protection for private records before enabling offline access. Never cache authenticated SSR responses as a public shell or store Stripe keys in the client. Validate service-worker scope/update behavior and old-shell/new-store compatibility. Do not activate a worker over all existing API calls.
3. **Incremental repository integration.** Replace one UI's direct fetch dependency at a time using an explicit repository boundary. Show local save, pending sync, conflict, unavailable and last verified states. Keep financial calculations in existing shared pure modules. Expand through notes/tasks/expenses, estimates/draft invoices, scheduling/reports/templates and photos. Preserve shared code across all isolated targets; hosting and auth remain explicit adapters.
4. **Deliberate sync and reconciliation.** Separate local records, base server revision, tombstones and operation receipts. Use conditional version checks and stable operation IDs; ambiguous network outcomes require querying receipt/state before retry. Retain outbox entries until verified acknowledgement. Resolve concurrent edits visibly; never use silent last-write-wins for invoices, payment/refund ledgers or relationships. Financial operations, customer messaging and provider actions require online review. Existing backups/provider uniqueness guards must remain enforced.
5. **Offline recovery and physical-device evidence.** Add portable records and photo archive export/import using the established validator invariants. Test interruption, invalid relationships, duplicates, partial and failed refunds, schema upgrades, quota failures, concurrent tabs, obsolete caches, account changes and server conflicts. Test all intended targets and same-device light/dark rendered behavior before any parity claim.

## Recovery and durability requirements

IndexedDB is local device storage, not the only backup. Browser storage can be evicted, cleared or lost with a device. Request persistence where supported, handle denial and QuotaExceededError, monitor capacity and make external export easy. A completed transaction signals commit; do not promise survival of every power-loss scenario. Photo storage failures must leave existing records and photos recoverable and never report an incomplete archive as verified.

Keep a versioned, downloadable source/build package and separately exported records/photo backups under owner control. Test reconstruction on a clean device. Initial iPhone PWA installation and reinstall may require an accessible free HTTPS origin; Home Screen installation alone cannot guarantee operation after cache eviction or permanent host disappearance. If stronger independence requires a different packaging approach, compare free feasible options before committing to that architecture. No paid native distribution or ongoing hosting commitment is authorized.

Restore must be an explicit owner action with preflight, attempt identity, phase tracking and post-apply verification. Reuse existing records-backup integrity rules for ownership, cumulative reserved refunds, succeeded refund ledger matching and verified legacy format compatibility. Preserve existing data on rejected input. After an interrupted attempt, inspect audit/state before retry; never blindly replay provider actions. Production data must not be copied into DR for testing.

## iPhone acceptance script — future approved candidate only

Use synthetic comparable data and the same Home Screen mode for original and candidate. After installation and a verified local seed, turn on airplane mode with Wi-Fi off, close the app, reopen it and navigate all main sections. Create/edit customers and drafts, calculate pricing/tips/fees, add notes/tasks/expenses/photos and preview/export documents; verify restart retains them. Confirm same-section editing keeps scroll and changed sections start at top. Online-only actions must explain why they are unavailable and retain drafts. Export records and photo bytes, verify the archive, then restore into an isolated disposable profile. Reconnect and verify explicit sync/conflict behavior without real Stripe actions. Test quota denial/eviction/reinstall recovery separately; a single warm cached launch is insufficient evidence.

## Official references used for design constraints

- WebKit storage policy: https://webkit.org/blog/14403/updates-to-storage-policy/
- IndexedDB transactions and local storage: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- Transaction completion: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event

These references inform the design; they do not verify the current application or actual iPhone behavior.
