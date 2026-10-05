# FIRE App v138 — Independent Recovery Go / No-Go Gate

## Current deployment model

The active independent DR staging design is intentionally **free-tier, D1-only, no R2**.

- Worker: `fire-app-independent-staging`
- Isolated D1: `fire-app-staging-db`
- Temporary host: `workers.dev`
- Owner access: DR-only 4-digit PIN overlay plus signed session cookie
- Photo-file storage: **not provisioned** in this DR deployment

The missing R2 binding is an explicit capability exception, not a hidden success condition. Photo UI may be compared visually, but upload/archive/download cannot be called functionally identical to LIVE while storage is absent. Photo APIs must fail closed rather than pretend success.

## Source package status

**GO for isolated staging preparation** only when the governed source/deployment gates pass and the sealed v138 archive hash matches the approved archive.

The current Cloudflare preparation path applies the DR PIN/mobile/Templates overlays plus stored-LIVE evidence corrections, then runs eight DR-specific parity/governance guards before building:

- LIVE parity overlay guard
- Owner-workflow parity guard
- Owner-approved customer forward-sync guard
- Full LIVE service-catalog order guard
- LIVE-evidence coverage/accountability guard
- Customer-workflow parity guard
- Formal parity-ledger consistency guard
- Final release-readiness guard

The LIVE-evidence coverage guard requires every formal state already marked LIVE `CAPTURED` to be explicitly mapped into current DR parity protection. A newly captured LIVE state intentionally blocks the build until that mapping is updated.

The final release-readiness guard derives blockers from the formal manifest and requires every release-facing document to stay conservative while parity is incomplete. It can report `READY_FOR_EXPLICIT_OWNER_REVIEW` only when the manifest completion rule is satisfied; it never synchronizes or modifies production automatically.

A passing source/governance gate does **not** mean rendered parity is complete. The current status must remain `NOT_YET_FULLY_VERIFIED` until the required LIVE and independent evidence is captured and compared.

The structured forward-sync registry tracks owner-approved user-facing blockers such as the richer DR customer-profile command center and Edit existing customer. Every entry that remains `PENDING_LIVE_SYNC` intentionally blocks `FULL_IDENTICAL` until LIVE is upgraded and same-device rendered/functional comparison confirms that specific forward sync.

## GO for current D1-only DR staging when

- the staging Worker and D1 are isolated from production;
- the sealed v138 archive SHA-256 check passes;
- all 21 migrations (`0000` through `0020`) are applied to the isolated D1 in order;
- the production build succeeds;
- all eight DR parity/governance guards pass;
- owner PIN login and session behavior work;
- staging uses only disposable/test data unless the owner explicitly approves a recovery import;
- no production domain, production D1 database, production R2 bucket, or real customer data is attached;
- Stripe, if tested, uses the intended staging/test configuration;
- photo-file features remain visibly/technically fail-closed while no storage binding exists.

Known sealed-v138 TypeScript errors remain a nonblocking deployment fact; do not misreport them as a passing typecheck.

## NO-GO for FULL parity / production-recovery claim until

- required independent parity evidence is captured and registered;
- each required formal parity state is compared against LIVE;
- every required comparison is `VERIFIED_IDENTICAL` or explicitly approved as an infrastructure-only exception;
- any remaining customer/owner visual mismatches are corrected;
- every `PENDING_LIVE_SYNC` entry in `FORWARD_SYNC_APPROVED.json` is intentionally brought into LIVE and verified;
- the formal evidence manifest and strict parity gate agree;
- the final release-readiness guard reports `READY_FOR_EXPLICIT_OWNER_REVIEW`;
- any storage capability required for real photo recovery is separately provisioned and tested before claiming photo-file recovery capability.

## Production safety

Do not:

- attach `firstinresponseexteriors.com` during staging;
- change LIVE hosting or DNS while closing DR parity;
- import real customer data before explicit owner approval;
- reuse production Cloudflare resources;
- claim photo upload/recovery works in the current no-R2 DR deployment;
- enable or test live charging merely to prove UI parity.

## Promotion rule

The D1-only independent DR can be used as isolated staging/recovery validation without R2. **FULL_IDENTICAL** and full operational photo-recovery claims remain blocked until the formal rendered-evidence requirements and any intentionally omitted capabilities are resolved or explicitly accepted as infrastructure-only exceptions. Even after the evidence gate becomes ready, production synchronization remains an explicit owner-controlled action.
