# Candidate offline Customers integration

Base checkpoint: `c8cdc76de902236a66480c1f4a74725bb77b3d70`.

Offline Customers is connected to an actual development route, `/development/local-customers`, with a React panel using the tested repository, DOM view and lifecycle controller. The owner server mapping supplies a separate synthetic account and target namespace. Fixed deployment adapters preserve LIVE, Doomsday and staging target separation. The shared parity gate excludes only this new fixed target adapter; functional and presentation code is identical.

The existing Customers tab shows an entry link only when the server runs in development mode with `FIRE_LOCAL_CUSTOMERS_CANDIDATE=synthetic-only`. The route independently enforces both conditions, then calls the existing owner auth adapter. Production stays disabled even if that flag is supplied. No production config was set. Existing online Customers and financial screens remain unchanged except for the gated navigation link. There are no added server/API/Stripe customer or financial calls.

The panel mounts locked, inspects only snapshot presence, and requires explicit empty synthetic test-vault creation. Occupied snapshot initialization remains rejected atomically. Create/edit saves display current revisions and local pending operation receipts. Loaded-screen editing works offline; reload retains encrypted contacts. Lock, identity change and React cleanup clear plaintext/drafts and close the controller. In-flight initialization is closed on cleanup. Home/Back and a local theme toggle are available. Namespaces use synthetic prefixes and do not open the prior iPhone/iPad demo vaults. No backup recovery or data migration is included.

## Verification

- 18/18 affected integration checks per candidate, **54/54 aggregate**.
- **3/3 full application builds** and **3/3 full-project TypeScript checks**.
- Existing dashboard balance regression: 69/69 per candidate, **207/207 aggregate**, synthetic in-memory SQLite only.
- **129 shared runtime files, zero differences**; fixed deployment adapter values separately verified in browser result identities.
- **63 existing API/schema/migration source files unchanged** relative to the base.

The integration test invokes the actual server page bundled with a substituted synthetic auth helper, then renders the actual React client component in Chromium. A signed localhost session cookie gates the fixture server. This is synthetic session coverage, not proof of the real authentication gateway/cookie adapter or a full running framework session. Native IndexedDB/WebCrypto verify persistence and account separation. Both 320px themes fit. Light mode remains light under a dark host page.

A file-copy variable mistake temporarily put the wrong isolated source in two candidates; parity/type checks caught it. Correct Dashboard source was restored and all final builds/type/browser checks rerun. No deployed file was touched. A theme selector was also corrected so a host dark theme does not override explicit panel light mode. The financial test's VM fixture now supplies a production-mode process object for the newly gated Home prop.

## Next priority and blockers

Run the integrated candidate route on an actual local framework server with synthetic authenticated/database fixtures, checking app navigation and lifecycle. Actual deployed auth, remote schemas, sandbox integration, photo storage, installed offline Home Screen launch and rollout/rollback gates remain unverified. Plan an owner-held archive import separately; do not auto-import online records or attempt device recovery. Bottom-of-screen shaking remains unresolved and is not claimed fixed by this panel.

No deployment/activation in LIVE, Doomsday, refund staging or original saved Home Screen apps occurred. iPhone Revision 3, iPad Revision 1 and original encrypted backup remain protected. No recovery, storage clearing, resets, app deletions, Stripe, Cloudflare production resource/database changes or paid service occurred. Official release readiness remains **3/10 (30%)**.
