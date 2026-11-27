# Exact CI full-app review bundles

Application checkpoint b3c94ea09d11d2aed9fd32540d63bdbf544dc5e2 passed all six jobs in https://github.com/kylebrooks86/first-in-response-website/actions/runs/38930582541. This independently verifies the photo-save byte checks, interrupted mutation review, snapshot-bound photo/records planner, complete-table rollback, financial/refund/schema regressions, TypeScript, independent build and all three coordinated candidate builds. Local supplementary browser suites passed 57/57 additional assertions: actual Customers photo fallback 12, synthetic offline process restarts 11, portable package 7, isolated HTTPS fixture 9 and guarded React customer screen 18. Together with the three candidates' 237 photo browser assertions, 294 local browser assertions passed; none establish real iOS acceptance.

The next CI pipeline now seals an individual review ZIP and receipt after each coordinated candidate successfully builds. Artifact names are `fire-full-app-review-{live|doomsday|staging}-{exact-commit}`. Each receipt records the exact checkpoint, build ID, all packaged file hashes and the archive SHA-256. The complete three-target CLI remains supported for local review. Six unit methods now cover normal/single-target CLI, invalid mixed modes, bytes, privacy, missing builds, overwrite refusal, source/root/config symlinks, fixture exclusion and failure cleanup. All three new single-target CLI paths were also exercised against actual successful candidate builds. Workflow YAML structure and read-only GitHub permissions were checked locally.

These are full Business App source/build review artifacts; they are deliberately NOT installation URLs or self-contained offline apps. No deploy command or provider configuration is emitted. The only CI write is retaining the reviewed artifacts for seven days. Build artifacts contain no customer database/state or environment files, and exclude hosting configuration/source maps. Dependency lockfiles, source business logic, all existing environments and migrations remain unchanged by this follow-up. A separate reviewed/authenticated synthetic-only HTTPS runtime remains necessary to test the actual full app on iPhone/iPad. Do not upload a bundle into an existing deployment or install over an existing Home Screen app.

The new pipeline must pass on its own exact commit before its artifacts are used. A successful previous application's CI is not proof that a later workflow/tool change passed. Use the exact Actions run and three candidate artifacts when reviewing a future narrowly scoped publication proposal. No publication, database/resource creation, binding change, Stripe action or physical recovery is authorized by an artifact.

Official readiness stays 3/10 (30%). No additional production gate accepted. The owner's next action remains only the read-only normal Edge stored-vault presence screenshot at the existing synthetic demo. Existing iPhone Revision 3 and iPad Revision 1 vaults and original backup/phrase are protected. Never initialize an empty recovery target. Support's LIVE/refund-staging physical identity response remains pending; confirmed Doomsday Worker/D1 evidence is not requested again.


## October 16 follow-up — independent artifact verification passed CI

The owner completed the **separate Acer Microsoft Edge synthetic recovery** check: transfer/verify Revision 3 encrypted iPhone backup, restore into a verified empty Edge vault, unlock Revision 3, relaunch with Wi-Fi off, refuse repeat restore with the original Revision 3 still readable. Owner-supplied screenshot evidence is in `GATE8_ACER_CROSS_DEVICE_RESTORE_OWNER_EVIDENCE_20261016.json`. This is **synthetic-only Windows** evidence, not an iOS full Business App acceptance pass. Do not repeat or reset the owner's completed Acer synthetic test.

To narrow the next full-app test-hosting blocker, the repo now includes
`verify_device_review_packet.py` (read-only) and
`test_verify_device_review_packet.py`. The existing CI source/build review ZIP
for **each** coordinated target is independently re-opened and checked
**before its artifact upload**, using the exact `GITHUB_SHA`, receipt SHA-256,
every member hash, source/build fingerprint, required build ID, exact target,
and strict exclusions for unsafe paths, symlinks, environment files,
databases and source maps. Negative tests cover forged metadata, swapped
contents, duplicate/path-traversal entries, unsafe sidecars and source commit
mismatch. This does not cryptographically sign the receipt or verify a
future deploy; the trusted GitHub run and exact SHA remain required.

All six GitHub CI jobs passed for application review checkpoint
`42549a46c856e88a43b3ada63cb2eda1a3fe8a26`:
https://github.com/kylebrooks86/first-in-response-website/actions/runs/38968021338

Retained for seven days as GitHub Actions artifacts:
`fire-full-app-review-live-42549a46c856e88a43b3ada63cb2eda1a3fe8a26`,
`fire-full-app-review-doomsday-42549a46c856e88a43b3ada63cb2eda1a3fe8a26`,
`fire-full-app-review-staging-42549a46c856e88a43b3ada63cb2eda1a3fe8a26`.
There is also a separate synthetic PWA review package. These full-app
review archives **cannot be installed or served directly as the mobile app**.

For a downloaded coordinated review artifact, keep the enclosed review ZIP
and `DEVICE_REVIEW_RECEIPT.json` together in a private ordinary folder and
verify without extraction or external connections:

```sh
python3 business-app-parity/verify_device_review_packet.py \
  --packet /path/to/review-folder \
  --target staging \
  --checkpoint 42549a46c856e88a43b3ada63cb2eda1a3fe8a26
```

**Next actual release milestone:** prepare one isolated, temporary, owner-
approved synthetic-only HTTPS full Business App runtime with a new
non-production database, independently verified free quota, separate
authentication, no LIVE/staging/Doomsday resource binding, and known
immutable deployment/artifact hashes. First obtain specific owner permission
and verify provider access/resource isolation. Do not upload the existing
review ZIP into an existing deployment or point it at an existing database.
Only once hosted runtime isolation is proven can iPhone/iPad physical full-app
acceptance begin. No target was created or deployed by this batch.
Official readiness remains 3/10 (30%).
