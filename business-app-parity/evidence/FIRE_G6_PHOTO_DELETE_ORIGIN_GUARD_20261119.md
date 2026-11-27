# FIRE Gate 6 — owner saved-photo DELETE same-origin boundary (Nov 19, 2026)

## Defect and actual code fix

After the shared owner-write browser-origin protection for JSON, records restore, and multipart photo upload, the independently routed **`DELETE /api/customer-photos/[id]`** still authenticated the owner but did not inspect the request's browser Origin / `Sec-Fetch-Site` header. That deletion first removes the customer's D1 photo reference and then, after careful remaining-reference readback, deletes its storage object. Browser CSRF isolation belongs **before** either step, not after the metadata query.

[Actual source fix `a80e69108b25e2eaf4df830821deb65461bf54f9`](https://github.com/kylebrooks86/first-in-response-website/commit/a80e69108b25e2eaf4df830821deb65461bf54f9) adds the same reviewed `ownerBrowserWriteScope(request,false)` immediately after existing owner authentication, **before** storage binding inspection, object-key query, D1 deletion, and object deletion. `false` deliberately avoids requiring a JSON body for ordinary valid same-origin DELETE. Existing authorization, exact photo ID/object-key delete conditions, post-D1 remaining-reference check, conservative no-byte-deletion on uncertain metadata, and R2 DELETE/HEAD verification are preserved. No bucket was created or touched.

[Focused source/test commit `e2e8ce6702bcfc58b9d2784cb27374f5d4357695`](https://github.com/kylebrooks86/first-in-response-website/commit/e2e8ce6702bcfc58b9d2784cb27374f5d4357695) extends the already-established `business-app-parity/cloudflare-launch/customer-write-guard.test.mjs` with:
- Same-origin owner DELETE accepted with **no body**.
- Cross-site foreign Origin, same-site sibling fetch, and cross-site Fetch Metadata without Origin rejected.
- Actual source route must call the boundary **after owner auth and before** D1 key lookup, metadata DELETE, or storage DELETE.
- Existing previously tested JSON/restore/multipart owner write protections retained.

## Independently observed exact-source checks

The exact reviewed source/test head was `e2e8ce6702bcfc58b9d2784cb27374f5d4357695`:
- [Staging/QA Actions #44520888996](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44520888996), job `135548913125`: **`Gate 6 public estimate, change request and revised signature bounded request-body guards (OFFLINE)` step COMPLETED SUCCESS**, including the two new saved-photo DELETE tests and prior route/JSON/backup/photo safety tests. At evidence capture, broader built QA/browser workflow had not finished; do not claim the **entire** run SUCCESS.
- [App-only website/calculator protection #44520888621](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44520888621): COMPLETED SUCCESS on that SHA.
- [Verify FIRE website #44520889128](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44520889128): COMPLETED SUCCESS on that SHA.
- No app hosted HTTP, Cloudflare authenticated provider, D1 data, R2, Stripe, or customer photo bytes were used; all route-order checks and synthetic requests run locally in CI.

## Decision and release acceptance

**[x] Source-level G6-08 photo-delete browser CSRF omission repaired and targeted regression passed.** This is a subordinate code/test repair, **NOT** a new one of 95 formally accepted checklist items. **G6-08 [ ] remains OPEN** pending actual hosted private Access and multi-identity/CSRF/zero-write evidence, G6 and G7 stay OPEN. No approved provider rollout.

Official prior board **50/95 accepted, 45 open; 4/10 release gates accepted G1/G2/G3/G8, remaining G4/G5/G6/G7/G9/G10 OPEN.** NEW LIVE remains DARK/NO-GO, first real Job #0001 unissued. Existing owner Acer dual-DARK read-only STOP, previous iPhone QA and 3-original-photo restore are not repeated. No paid Cloudflare/R2, provider login, database SQL write, Stripe payment/refund, Git merge, deployment, public website publish, or LIVE access change.
