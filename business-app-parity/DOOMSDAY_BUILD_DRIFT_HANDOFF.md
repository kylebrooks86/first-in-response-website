# Doomsday build-path drift — October 9, 2026

Resumed 40c2de5922a5d5777706292b2baefd8a628eb9be. Local checkout was clean and remote development head matched. FIRE Business App only.

The documented authenticated /api/dr-capture-identity endpoint was attempted once through the existing Doomsday browser session. Browser returned net::ERR_BLOCKED_BY_CLIENT. This is an access limitation, not a proven server status or bot block. No retry of the previously failed /api/app-version endpoint was made. No Cloudflare deployment metadata connector is available. Actual deployed commit remains unverified.

Saved source investigation identifies a concrete integration gap: scripts/prepare-fire-v138-dr-no-r2.sh extracts the sealed v138 archive into fire-app-dr, applies its historical overlays, and requires the older fire-calculator-exact-live-clone branch. The branch name is an existing Business App build dependency; no calculator code was inspected or edited. Neither prepare nor deploy script consumes business-app-parity/shared. The reviewed candidates are intentionally outside this publish path, as README.md already states.

At the inventory reference commit e516af3ce93368450cd3d02906d117116d090f3e, fire-app-dr/app/dashboard.tsx has no Insights navigation/view or ScheduleWeather dashboard feature. Both are present in the current shared candidate. Literal feature markers are also absent from the apply overlays invoked by the saved preparation script. This is consistent with the two observed desktop gaps; it does not establish the actual deployed Worker source or prove all runtime behavior.

Do not run the old deploy wrapper to try to publish the new candidate: it ignores that candidate and automatically applies remote D1 migrations. No preparation/deploy script was run, no rollback archive or legacy source was altered, and no database, Stripe, settings or deployment mutation occurred. No speculative dashboard patch was made because the candidate already contains both missing features.

Verification: inspected source/build dependencies and exact inventory reference; checked two candidate/legacy feature differences; hashed the investigated files; parsed evidence/progress JSON; git diff --check. Documentation-only batch, so unchanged application tests were not repeated.

Scoped status: 2/2 investigated features differ in saved legacy versus candidate source. This is a source finding, not a parity pass. Formal deployed/mobile parity remains 0/32 (0%); complete remote schemas 0/3 (0%); readiness 3/10 (30%), NOT READY.

Next bounded implementation: validate the current isolated Doomsday candidate's PIN/session adapter against the documented independent auth contract and prepare a local-only build bridge to consume the current shared source. Preserve the sealed v138 archive, old rollback path, independent authentication, resource bindings and migration histories. Verify the bridge before proposing any deployment. Current generic candidate Vite configuration must not be published. No new user intervention is needed for local work; production remains unchanged until an exact release is approved.
