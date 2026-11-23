# FIRE G4-04 STAGING — consumed one-shot and incomplete read-only version inventory (Nov 22, 2026)

## Original owner Acer screenshot — new evidence, no secrets published
- Local timestamp approximately 19:29 CST, Nov 22, 2026; uploaded image 1918 x 1005 px, SHA-256 `d70f29968947958c2d3819b5a0a1acc1be36cdacefc9c8293129af8dd2f9be31`. Original retained in owner conversation; do not commit screenshot or any local credential.
- The existing isolated STAGING build from pinned source `f2de14be1ed4e1b624cee88848417e15f0943f6b` already physically passed local materialization/typecheck and offline safety preflight; `deployed:false`, `remoteSchemaVerified:false`, `publicationAuthorized:false`.
- The owner ran exactly ONE previously authorized `owner_staging_one_inactive_version_once_approved.ps1 -CandidateDirectory $dest -Execute`; the guarded output was `STOP: ONE upload may have occurred. DO NOT RETRY. Read-only reconcile only.` This upload permission is spent, the local attempt lock MUST remain intact, and the remote upload result is UNKNOWN.
- Owner downloaded pinned read-only helper from GitHub commit `794e9c7b6f6c35747876f4be0c7891428b1cec43` via `Invoke-WebRequest -UseBasicParsing`. The subsequent invocation `& $reconcile -CandidateDirectory $dest` returned exact text `STAGING READ-ONLY STOP at READ_STAGING_VERSION_LIST: evidence incomplete. NO RETRY; NO CLOUD WRITE.`
- This stage proves the GET-only helper proceeded past cached credential acquisition, serving deployment response, and old version D1/payment-binding validation. It does **not** prove the old deployment was unchanged: the helper computed, but did not yet enforce, the `servingUnchanged` flag. Nor does it prove the version list was retrieved, uploaded version exists, no version exists, or any new version was activated.
- No second upload, fresh browser login, secret extraction, payment credential change, Worker traffic/Access/route/D1 change, Stripe transaction or paid R2 activation was authorized or observed.

## Actual GitHub source correction, still unmerged/undeployed
- Reviewed the source at the failing `READ_STAGING_VERSION_LIST` stage and confirmed the generic catch previously suppressed the exact failure branch. Cloudflare documents the GET-only Worker Versions List endpoint and paginated `result.items`; the particular failure on the Acer remains undiagnosed.
- Corrected source commit `29b17188e622ae962a3d8b677f735c29d4886efa`: bounded at most 3 ordered pages of version-list GETs; safe stop if the authorization-window inventory is incomplete or malformed; sanitized HTTP/status/validation reason codes; still zero POST/PUT/PATCH/DELETE or Wrangler upload/deploy commands.
- Targeted CI-wired static regression extended in `88458091871661845f494b2015c388e02a144739` and test assertion corrected in `8b45efa5bdf26db6df71b7fcddf0dd2f2b046954`. Initial intermediate patch `fc81a23` was replaced in place by corrected source `29b1718` before any owner execution. No previously accepted hosted evidence invalidated.
- Current exact test HEAD `8b45efa5bdf26db6df71b7fcddf0dd2f2b046954` triggered 27 GitHub PR workflows. At initial read the workflows were queued/pending/in progress; **do not call full CI successful until completed**.
- Owner can run the **updated read-only reconciler only** on the Acer using the existing local `$dest` and cached Wrangler session, once ready. No new upload consent; do NOT run `-Execute` again. Do not re-request previous QA/Access/other-Worker/screenshots or repeat accepted evidence.

## Checklist / release boundaries
- [x] Owner upload attempt consumed and correctly fail-closed; existing old one-shot and local build evidence preserved.
- [x] New physical read-only version-list STOP evidence captured and safe-bounded helper code/test correction committed.
- [ ] Physical inactive version inventory unresolved; original numbered G4-04 remains OPEN.
- [ ] Source/remote version byte parity, hosted owner/nonowner behavior, Stripe TEST, G4/G5/G6/G7/G9/G10 remain OPEN.
- **Official 51/95 original numbered checks; 4/10 formal gates accepted G1/G2/G3/G8; NEW LIVE DARK/NO-GO; authentic Job #0001 not issued.**
- No app Cloudflare upload, activation/deploy, D1/SQL/migration, paid subscription/R2, Stripe/payment, source merge, DNS/Access or public website change was caused by this GitHub development.
