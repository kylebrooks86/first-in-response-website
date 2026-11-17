## Exact-source corrected CI result — no TypeScript install required

**Focused exact-source CI confirmation:** The first behavior-harness commit `474802fb` caused **only a test dependency failure** in the no-install Node runner (`Cannot find module 'typescript'`); the application component was not shown to fail. [Correction `1fc4fda`](https://github.com/kylebrooks86/first-in-response-website/commit/1fc4fda895c7b9c03bc79f1f0398804be3193961) removes that dependency: the existing offline test executes the **actual useEffect source body** under a fake browser after stripping its two TS type annotations, with focus/pageshow/visible revalidation, 401/403 denial, superseded prior success, cleanup and zero post-unmount updates. [Exact corrected-source workflow #44151903570](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44151903570) **COMPLETED SUCCESS**, including step “Gate7 complete records/photo owner capability hidden until separately authorized” and **53/53 focused owner availability checks PASS**. Entire new-head CI matrix was still underway at the first verification; this focused PASS is not hosted or Gate6/Gate7 acceptance. No new owner test or provider action.

Historical explanatory text below describes the earlier simulated TSX harness. The **current** executable harness is a dependency-free execution of the actual React effect body plus the existing unchanged owner-capability route test.

---

# FIRE — Owner-protected complete records/photo review: session revalidation (2026-11-17)

**Source correction:** [e0c87182](https://github.com/kylebrooks86/first-in-response-website/commit/e0c87182f2ef1531e76fa259e7a1e7b23aa74413), followed by [actual behavior-focused regression 474802fb](https://github.com/kylebrooks86/first-in-response-website/commit/474802fb9c2abd12dc7893d9f23a43136f1a4de8), both on existing **unmerged Draft PR #270**.

## Actual gap and fix

The existing owner recovery availability component correctly required a private same-origin 200/no-store authenticated capability before mounting the encrypted full-records and protected photo-pair widgets. However, it only performed the GET on first React mount. If an already-open owner session expired or was revoked without a full-page reload, the sensitive recovery panels could remain visible in the same tab on a stale allowed state. The existing owner-only export API still performs its own independent check; this patch specifically closes the stale on-screen capability lifetime.

The React effect now re-requests **only the existing local GET** `/api/backup/review-capability` on window focus, restored `pageshow`, and becoming visible. A non-200, redirect, missing/incorrect private+no-store headers, wrong response shape, denied owner session or fetch error sets the authorization state **false**. Superseded requests are aborted and checked against a monotonic request generation so a late previous success cannot reverse a newer denial. On unmount the listener set and pending request are cleaned up. The already-existing capability remains default OFF; this patch does **not** enable a review flag, deploy the UI or alter owner login/Access.

The actual React component deliberately keeps its owner review controls mounted while a native Files picker returns focus, until the read-only check finishes, avoiding lost selected-file events. A refused check then unmounts the sensitive panels and drops in-memory prepared file references. No customer records, passwords, files or secret values are posted through this validation.

## Tests and boundaries

Existing `shared/scripts/test-complete-records-owner-availability.mjs` now includes source assertions and a **simulated execution of the real compiled TSX component** with stubbed React hooks, owner-capability fetch and fake focus/visibility/pageshow events. It checks permitted owner 200, revoked 401, reapproved return, 403 winning over a late earlier 200, removed listeners on unmount and zero post-unmount state changes. No external network/device/provider request is made. Exact changed-source test SHA `474802fb9c2abd12dc7893d9f23a43136f1a4de8`; GitHub Actions were still running at documentation, so no full CI PASS is claimed.

**Evidence is source and synthetic regression only**, not actual hosted owner/nonowner denial, Cloudflare Access policy confirmation, authenticated production deployment, off-device recovery, or final release. Master **45/95 checked, 50 open; 4/10 formal gates G1/G2/G3/G8 accepted**, G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE remains DARK/NO-GO. October real iPhone photo restore stays accepted without repetition.

No Cloudflare login/attempt, paid subscription/R2, production Worker/D1/Access/route/auth/Stripe mutation, deploy, merge, customer communication or owner test performed.
