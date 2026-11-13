# Synthetic Customers controller checkpoint

Base: `498720eb59dbd49987a78bc31209c55301c0f679`.

`createSyntheticCustomerController(root, { targetId, readIdentity, idleMs })` connects the opt-in synthetic Customers DOM view to a scoped encrypted vault/repository. The target config is copied at construction. Account/target tokens must be valid and the supplied target must match. Missing, malformed or throwing identity resolvers refuse activation. The controller does not authenticate a user: its caller must supply an identity from a separately verified server adapter. No email, owner profile, URL or environment label is used to infer vault identity.

Activation closes the previous connection, opens only the selected namespace and mounts locked. It never initializes a snapshot, restores a backup or automatically unlocks. Asynchronous opens use a generation check so superseded activations cannot mount. Identity is checked before read/unlock/save and on repository notifications. Call `refreshIdentity()` immediately on logout, account change or target change; no polling is claimed. Changed identity revokes the old view and clears drafts/inputs. A target change requires a new controller with approved config. Default idle policy is five minutes; page hide and idle expiry lock through the existing vault lifecycle. Disposal prevents late mounting and closes the storage connection.

## Native test evidence

18/18 checks on each isolated LIVE, Doomsday and staging candidate: **54/54** total. Focused strict TypeScript: **3/3**. Shared runtime source: **125 files, zero differences**. Real Chromium 153.0.8010.0 IndexedDB and WebCrypto, disposable profiles and synthetic localhost only. Tests cover missing/wrong identities, namespace separation, logout draft wiping, identity change before save, overlapping activations, reactivation, identity loss during opening/decryption, page exit, idle locking and disposal. Page lifecycle events are dispatched in Chromium; physical iPhone/iPad behavior remains untested.

Expanded tests found teardown notifications could invalidate a following activation and leave Opening displayed. Capturing activation generation after teardown and ignoring already inactive guard notifications fixed it. Final three candidate runs include the regression and pass.

## Authentication review and limits

The owner-account component is an informational hard-coded profile, not a storage identity source. LIVE's auth helper uses gateway user ID with email fallback; independent owner auth returns fire-owner after signed-cookie validation, the candidate chatgpt-auth wrapper re-exports that independent owner-auth guard. These differing adapters require an explicit stable opaque business account mapping and a fixed app target from validated server authentication before runtime activation. Synthetic readIdentity callbacks do not resolve that release gate.

Existing app routes, Dashboard, auth files, financial history and server APIs are unchanged. Full app compilation, mobile light/dark appearance, installed offline Home Screen launch and deployed parity remain unverified. Existing 45/45 view and 78/78 repository evidence is preserved; their unchanged standalone suites were not rerun. The new integration suite exercises both layers.

Next bounded batch: provide an explicit isolated synthetic candidate screen using the controller and check mobile light/dark layout; verify server identity mapping separately before real Customers activation. Whole-screen shaking remains unresolved.

LIVE, Doomsday, refund staging, FIRE Calculator, original Home Screen app, iPhone Revision 3, iPad Revision 1 and original encrypted backup were untouched. No device recovery, resets, storage clearing, deployment, production DB, Stripe or paid action occurred. Official readiness: **3/10 (30%)**.
