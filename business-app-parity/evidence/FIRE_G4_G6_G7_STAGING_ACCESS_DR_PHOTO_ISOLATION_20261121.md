# FIRE Nov 21: STAGING external Access classification and DR photo key identity fix

## New provider-observed STAGING ingress (anonymous/read-only)
After the already captured owner-applied `All traffic` Worker Access UI receipt `IMG_4580.png` (saved against Issue #19), a fresh unauthenticated live content fetch used only these exact production-hostname URLs:
- `https://fire-app-independent-staging.kyle-bfc.workers.dev/` — result: `login_required`
- `https://fire-app-independent-staging.kyle-bfc.workers.dev/api/customers` — result: `login_required`

The fetch backend returned only the classification, with **no raw HTTP numeric status, identity provider identity, policy details, redirect Location, or response body**. Never infer 302/403, hosted nonowner rejection or route-exhaustive protection. The existing Worker-wide-versus-original-production-hostname-only authorization distinction requires explicit scope reconciliation; do not change the owner's applied policy or touch shared TEST policy. G4-05/06 formally remain OPEN, while their post-policy unauthenticated challenge subproof is newly evidenced. No Cloudflare sign-in attempted.

## Actual preserved source and changed-code test
- Existing main-target integrated DRAFT PR #282 branch `work/fire-private-notes-followup-search-20261119`; exact three-file source/test code commit [`5d574c8250ffc7f67298e542f73b06248c7d9a1d`](https://github.com/kylebrooks86/first-in-response-website/commit/5d574c8250ffc7f67298e542f73b06248c7d9a1d).
- Actual DR original photo GET/DELETE previously trusted the photo D1 `object_key` as authority to fetch/deallocate R2 bytes. It now SELECTs `customer_id` with the original key and rejects keys not in exact `customers/{customerId}/{photoId}.{ext}` namespace. An invalid key returns private, session-varied, nonsniffable 503 before object GET, metadata deletion or bucket deletion. Existing SHA-preserving uncertain-ACK recovery untouched. No R2 bucket was created or used.
- DR source and its exact-byte tested fixture share blob SHA `1a8def9434daa6aa710f332f35f9e190e3cf9b94`. Existing `shared/scripts/test-photo-delete-integrity.mjs` now exercises DR wrong-customer and path-shaped invalid key GET+DELETE negative cases with zero D1/storage writes.
- Live GitHub [QA/STAGING #44903841860](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44903841860), job [136845147524](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44903841860/job/136845147524) **Gate 7 bounded photo upload, safe viewing and verified deletion** step SUCCESS, plus DR checkout TypeScript typecheck SUCCESS at exactly this code SHA. Last full 27-group readback: 26 SUCCESS, one parent IN PROGRESS, zero failed. Source subtask complete, no hosted proof.
- New issue evidence: [#7062569006](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7062569006), [#7062583194](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7062583194).

## Acceptance / owner safety
Formal 51/95 original accepted, 4/10 full gates accepted, G4/G5/G6/G7/G9/G10 remain OPEN, STAGING 22/25 physical migrations, NEW LIVE dark, Job #0001 unused. No owner authorization for provider/Access/migration/Stripe/merge/deployment changes supplied by this evidence or source commit. Preserve original owner screenshots and accepted QA/photo proofs; no redundant device testing.
