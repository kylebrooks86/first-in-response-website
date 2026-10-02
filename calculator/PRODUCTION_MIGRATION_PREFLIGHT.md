# FIRE Business Calculator — Production Migration Preflight

This is a planning and rollback document only. It does **not** authorize production deployment.

Production/live must remain unchanged until physical-device acceptance is complete and the owner explicitly approves promotion.

## Preconditions before any production action

All of the following must be true:

- [ ] Governed formula/LIVE-reference/offline-cache/shared-core fingerprint gate is green.
- [ ] Visual geometry suite is green.
- [ ] Behavior parity suite is green.
- [ ] LIVE → DR takeover is green.
- [ ] DR → isolated LIVE portability is green.
- [ ] Invalid-backup safe-error parity is green.
- [ ] Airplane-mode DR acceptance is green.
- [ ] Physical iPhone acceptance is complete.
- [ ] Desktop/laptop spot-check is complete.
- [ ] Owner explicitly approves production migration.

## Freeze the release candidate

Before production migration:

1. Record the exact calculator product commit being promoted.
2. Record the exact `SHARED_CORE_MANIFEST.json` fingerprint.
3. Record the offline-cache generation.
4. Confirm no calculator shared-core commit landed after the final accepted test run.
5. If shared-core changed, stop and rerun all automated gates plus the affected physical-device checks.

## Backup before cutover

Immediately before production migration:

1. Export a valid production backup from the current LIVE calculator.
2. Save it outside the browser session.
3. Verify it parses as a FIRE Field Calculator Backup v3 file.
4. Preserve the current production deployment/release identifier and rollback target.
5. Do not delete or overwrite the existing production source/deployment until the replacement is verified.

## Migration principle

Production must receive the **same governed FIRE Calculator shared core** already accepted in DR.

Do not manually rebuild or copy selected UI pieces.

Allowed production differences are infrastructure-only, such as domain/URL, hosting configuration, secrets/environment values, deployment credentials and cache adapter details that do not change calculator behavior.

## Production deployment sequence

Only after explicit approval:

1. Deploy the accepted shared-core release to the production adapter without deleting the previous working release.
2. Confirm production reports the expected display version.
3. Confirm production shared-core fingerprint exactly matches the accepted DR fingerprint.
4. Confirm the production service worker/cache activates successfully.
5. Open production in a clean browser session before importing any real backup.
6. Run the reduced production smoke test below.
7. Restore the pre-cutover backup only if required for locally stored state migration.
8. Repeat the reduced smoke test after restore.
9. Only then mark production and DR synchronized.

## Reduced production smoke test

Use disposable data where possible.

- [ ] Launch with no startup error.
- [ ] SH Mix recalculates.
- [ ] Equipment route opens and one calculation works.
- [ ] Chemicals and Chemical Index open.
- [ ] Job Math creates a sample estimate with correct total/deposit behavior.
- [ ] Customer/job state saves and reloads.
- [ ] Copy customer quote works.
- [ ] Share/Print actions open normally.
- [ ] Backup export works.
- [ ] Restore of a disposable backup works.
- [ ] Invalid backup gives the safe LIVE-parity error without wiping the estimate.
- [ ] Light/dark presentation remains normal.
- [ ] Mobile iPhone layout remains normal.

## Synchronization rule

Do **not** mark the release synchronized merely because both deployments display v18.

Synchronization requires:

- identical governed shared-core fingerprint in production and DR,
- accepted product commit recorded,
- automated release gates green,
- physical-device acceptance complete,
- production smoke test green.

Only after all requirements pass may governance status change from `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED` / `NOT_SYNCHRONIZED` to synchronized.

## Rollback triggers

Immediately roll back production if any of the following occurs after deployment:

- calculator fails to launch,
- fingerprint does not match DR,
- pricing/formula behavior differs,
- saved customer/estimate state is lost or corrupted,
- backup restore fails,
- navigation or major calculator routes break,
- mobile layout blocks normal field/action use,
- service worker/cache causes stale or broken startup,
- any production-only user-visible/business-functional behavior appears.

## Rollback procedure

1. Stop promotion; do not modify DR.
2. Re-deploy/reactivate the exact pre-cutover production release.
3. Confirm old production launches and works normally.
4. Restore the pre-cutover backup only if necessary and only into the known-compatible production release.
5. Record the failure before making any new shared-core change.
6. Fix the issue on staging.
7. Re-run all required gates before another production attempt.

## Production data safety

- Never test destructive restore/clear behavior using irreplaceable customer state.
- Keep the pre-cutover backup until the new production release has been stable and verified.
- Do not delete the old production deployment during the initial migration window.
- Never alter production DNS/hosting as part of a calculator-code test unless that infrastructure change was separately approved.

## Current authorization state

Production migration is **NOT AUTHORIZED YET**.

This preflight package is ready so that once physical-device acceptance is complete and the owner explicitly approves production promotion, the migration can be performed deliberately with a defined rollback path.
