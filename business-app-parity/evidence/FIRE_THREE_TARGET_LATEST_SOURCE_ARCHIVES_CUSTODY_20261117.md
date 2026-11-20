# FIRE — latest three isolated candidate source archives independently verified and privately preserved (2026-11-17)

**Version tested/source build:** `c9b6a5f2d267809ee30dcd6236042bbb6ad67f58` on existing **DRAFT/unmerged PR #270**. This executable commit includes the [owner checkout reconciliation source fix `10fb7ec`](https://github.com/kylebrooks86/first-in-response-website/commit/10fb7ecf6cb7df8baa4eedaf575712af5601811f), [native SQLite actual-route regression `35b2f8d`](https://github.com/kylebrooks86/first-in-response-website/commit/35b2f8d5276eca837a411cc84a1cb9c4081146e0), and [mandatory source-only Stripe mode suite `c9b6a5f`](https://github.com/kylebrooks86/first-in-response-website/commit/c9b6a5f2d267809ee30dcd6236042bbb6ad67f58). **This is NOT a Cloudflare deploy, credential/R2 activation, payment/DB/photo backup, release approval or actual hosted parity.**

## Independently downloaded GitHub Actions ZIPs — original archive bytes and complete file manifests

| Candidate | GitHub Actions source artifact ID | Actual ZIP SHA-256 (independently matched GitHub) | Actual ZIP size | Independently matched ZIP file inventory | Embedded original client assets | Actual candidate runtime config |
|---|---|---|---:|---:|---:|---|
| **Stripe TEST inactive, mode disabled** | 14377402118 | `882e2d4e74a459a031969b87fbf72f54d437cea6510ae7b72f4a3f5052833a2d` | 3,154,144 | **238/238** file hashes + sizes, exact saved inventory and receipt seal matched | **41/41** asset hashes/byte sizes | `fire-stripe-test-20261101`, DB `dba421ba-fc66-4cf8-9c31-51616f8249ba`, `FIRE_STRIPE_MODE=disabled`, R2 none |
| **DR current dark candidate** | 14378216128 | `4839cc8e6f35577f38c4c3abbf830a77d654d4414f12e9b6a7e9e3b74a15097c` | 3,166,046 | **244/244** file hashes + sizes, receipt/seal and canonical file inventory digest matched | **41/41** asset hashes/byte sizes | `fire-fullapp-dr`, DB `5e55c5b7-cd67-4c8f-a52e-40f71b5d3145`, `FIRE_ENV=isolated-dr`, R2 none, workers.dev/preview off, routes empty |
| **NEW LIVE current dark candidate** | 14376603389 | `767739331fa49798ff849ec10ebf0364c05edf1934d26c29f657c79ac30e3295` | 3,168,343 | **244/244** file hashes + sizes, receipt/seal and canonical file inventory digest matched | **41/41** asset hashes/byte sizes | `fire-fullapp-new-live`, DB `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`, `FIRE_ENV=new-live-prelaunch`, R2 none, workers.dev/preview off, routes empty |

**Avoid a critical artifact substitution:** Separate DR and NEW LIVE `FIRE-*-WORKER-ONLY-NO-ASSETS` source artifacts on the same commit still contain the deliberate all-zero **placeholder** D1 UUID and are **NOT** the independently reviewed physical-D1 current-dark packages above. Use the two exact `FIRE-CURRENT-DARK-independent-*` artifact IDs and SHA-256 checksums above. These are still *source packages*, not proven installed Cloudflare Workers; both receipts explicitly report `physicalD1Bound=false` because no hosted provider operation was performed. Source receipt Worker/D1 names/UUIDs are separate from actual authenticated Cloudflare readback.

### Original ZIPs actually saved to owner PRIVATE Google Drive

All three original artifact ZIP file references were uploaded to the **pre-existing** Google Drive folder `FIRE Business App Backups`, folder ID `1x9ocIiI9mQMtwf0YP0Q9HqxBWn1qyIjt`, with independent metadata readback confirming exact file size, same folder, **shared=false**, and user-only permissions. No new shared permission or paid service. These are versioned off-GitHub **source-package** archives only; no customer records, original photos, database snapshot, photo hashes, passwords or Stripe secrets stored here.

- **Stripe TEST:** [verified source ZIP](https://drive.google.com/file/d/1NZ3tW6CZJGn6tLHUSyTE7oZYZzFvb6pF/view?usp=drivesdk), file ID `1NZ3tW6CZJGn6tLHUSyTE7oZYZzFvb6pF`, 3,154,144 bytes.
- **DR:** [verified current-dark source ZIP](https://drive.google.com/file/d/1QWZ5IzjixJ-kA3IpCPPNS_kydWyPVSJz/view?usp=drivesdk), file ID `1QWZ5IzjixJ-kA3IpCPPNS_kydWyPVSJz`, 3,166,046 bytes.
- **NEW LIVE:** [verified current-dark source ZIP](https://drive.google.com/file/d/107VjmGIpptW7K-5KE8-olM6INzfR0zbg/view?usp=drivesdk), file ID `107VjmGIpptW7K-5KE8-olM6INzfR0zbg`, 3,168,343 bytes.

### Exact required tests, no Cloudflare owner test replay

[Full exact source GitHub CI](https://github.com/kylebrooks86/first-in-response-website/commit/c9b6a5f2d267809ee30dcd6236042bbb6ad67f58/checks) **25/25 workflow groups SUCCESS; 0 failures/cancelled**, including [staging/native/Chrome #44192673612](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44192673612) **6/6 jobs success**. Mandatory **“Gate 9 real owner checkout recovery respects TEST kill-switch (native SQLite, synthetic Stripe only)”** actual-source regression passed; the newly mandatory full payment-route isolation suite is included in current staging tests. The prior SHA `35b2f8d` staging run was cancelled after a newer workflow push, so use **`c9b6a5f` only** for a full pass claim.

### Formal limits unchanged

- Source package SHA-256 hashes **do not prove byte-for-byte hosted Cloudflare serving**, active Worker/D1 bindings, account-level routes/Access, owner/nonowner denial, encrypted customer data backups or signed Stripe TEST ledger events.
- **G4-01/02/05, G7-02/03/04/05/07, G9-03/04 and G10 remain OPEN** to the extent requiring target-bound host/owner approval or original records/photos; source archival does not imply formal closure. A separate precise owner approval is required before any provider POST/deploy/Access/SQL/Stripe/test traffic/merge.
- **45/95 atomic checklist items accepted; 50 open. 4/10 formal gates accepted (G1/G2/G3/G8). NEW LIVE DARK NO-GO, real Job #0001 remains unused.** No Cloudflare browser sign-in, credential/token creation, paid R2, hosted upload, Access/DNS/route switch, D1/SQL migration, payment, mail/SMS, Git merge or release performed.
