# Actual local Customers framework validation

Base checkpoint: `0edfea6d8981f39eea06f3219af75638ac5d922e`.

The actual Vite/vinext/Cloudflare workerd runtime exposed a development enablement bug: the Node launcher flag did not reach the worker. The local placeholder binding config now forwards `FIRE_LOCAL_CUSTOMERS_CANDIDATE=synthetic-only` only under development mode. Home and the gated development route read the worker env binding. Production mode still blocks the route and entry link regardless of flag. No production environment or resources were configured.

## Final verified results

- Actual local framework: 13/13 checks per candidate, **39/39** total.
- Existing component/server-page fixture regression: **54/54**.
- Full application builds: **3/3**. Full-project TypeScript: **3/3**.
- LIVE dashboard financial regression: **69/69**, synthetic SQLite only. Other unchanged financial suites were not repeated.
- Shared runtime source: **129 files, zero differences**. Updated Vite/test source also byte-matches all candidates.

The new `test-local-customers-framework-browser.mjs` launches actual candidate source with the same Vite/vinext/cloudflare plugins. A temporary copied worker configuration points persistence to a new disposable directory, and the existing SQL schema is applied only to a local placeholder D1 fixture. A synthetic signing secret exists only in the temporary config. Cleanup removes only newly created fixture/profile directories.

Actual LIVE/staging auth adapters receive synthetic owner/non-owner gateway headers on loopback. Actual independent auth validates signed-cookie fixtures using a temporary synthetic secret and rejects invalid signatures. These are real local adapter executions, not a provider/gateway deployment audit. No auth implementation was replaced. Tests cover authentication rejection, actual SSR/hydration, explicit empty synthetic vault initialization, encrypted saves/status, loaded-screen offline editing, lifecycle lock, reload persistence, desktop Home/Customers/entry navigation, 320px light/dark fit and no outside browser requests/runtime errors.

The earlier copied-source/symlink fixture produced an SSR error. Testing actual source fixed that fixture limitation. The wrapper CLI did not honor the temporary config, leading to an uninitialized local Home database; launching the underlying Vite CLI with the temporary config fixed test isolation and Home now loads with empty synthetic D1. None of these fixture changes modifies production data or deployed resources.

## Unresolved interaction evidence

Desktop navigation required bounded repeated native Customers clicks while hydration settled. Passing final navigation does not prove first-tap readiness. An earlier mobile menu attempt left the Customers button outside the viewport; its cause is not proven. Mobile menu/hydration readiness remains unresolved. The offline panel itself fits 320px in both themes, but that is not evidence that the original bottom-of-screen shaking is fixed. Both issues remain tracked.

Next bounded priority: reproduce mobile menu and first-tap hydration behavior, collect layout/event evidence around the bottom-shaking report and fix only a confirmed shared candidate cause. No further device recovery test is authorized.

No deployment, production Cloudflare resource/DB change, Stripe action, paid service, device recovery/reset/storage clearing or app deletion occurred. LIVE, Doomsday, refund staging, original Home Screen app, FIRE Calculator, iPhone Revision 3, iPad Revision 1 and original encrypted backup remain unchanged. Official readiness remains **3/10 (30%)**. Production identities, schemas, storage, real gateway, physical mobile and release/rollback gates still require independent verification.
