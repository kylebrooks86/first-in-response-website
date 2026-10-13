# Full app build restored and server identity mapping prepared

Base checkpoint: `bbdbaa2394b516e63cb1d709b16399ff4544889a`.

Full dependencies are now available in each isolated candidate. The initial LIVE build failed because vinext was absent. A pinned pnpm 11.25.0 bootstrap and frozen-lockfile installation restored the dependency graph without changing package.json, pnpm-lock.yaml or pnpm-workspace.yaml. Install scripts were disabled; the native full builds subsequently loaded successfully. Dependency directories/cache are reproducible local tooling, not GitHub application source. Use the existing project install workflow for normal CI; the recorded scripts-disabled command describes this bounded local restoration, not an instruction to weaken an established deployment workflow.

## Actual integration issue fixed

The first full-project TypeScript check found Cloudflare HTMLRewriter's Element.append global overload collided with browser DOM Element.append. Previous DOM-only focused compilation missed this combined type environment. The shared Customers view now uses appendChild through a typed Node helper. No suppression, unsafe cast, compiler weakening, auth alteration or financial logic change was required.

Final isolated LIVE/Doomsday/staging results: **3/3 full vinext application builds, 3/3 full-project TypeScript checks, 57/57 server mapping unit checks and 66/66 affected screen browser checks**. Source parity is 126 shared runtime files with zero differences. The first concurrent staging screen log was incomplete and was not counted; a standalone rerun passed 22/22. Its initial termination cause remains unproven.

Builds used the existing Vite config's local placeholder D1/R2 binding configuration; remote Cloudflare fetching and Wrangler metrics/log writes were disabled. This was compilation, not deployment or a production runtime test. A proxy-environment warning appears in build logs. All final commands exited 0, full typecheck logs are empty and builds report Build complete. No credentials or external customer/Stripe sources were used.

## Server mapping

`resolveLocalCustomerOwnerIdentity(authenticatedOwner, deployment)` is prepared for calls after the existing server authentication guard. It returns a stable opaque `fire-owner-account-v1` account, with distinct fixed `fire-live-v1`, `fire-doomsday-v1` and `fire-refund-staging-v1` targets. The existing owner email allowlist authorizes the principal; email/gateway subject/URL are not used as the storage namespace. Different authenticated gateway and independent-cookie subjects resolve to the same business account. Missing/non-owner/invalid principals or unknown targets are rejected; browser execution throws.

The helper is not an authentication mechanism. Its caller must obtain the principal from the existing trusted server auth adapter and supply a fixed deployment value. It is not wired into Home, Dashboard or API routes in this batch. Real authentication sessions and deployment security remain unverified. Do not create/migrate an owner vault automatically when wiring it. Keep the synthetic screen's namespace separate and preserve online financial/customer history until verified local integration is complete.

## Next bounded batch

Wire the server descriptor into a candidate-only local Customers panel and test the authenticated app shell using synthetic local database/session fixtures. Preserve existing online workflows and do not activate a production account/vault. Full build tooling is now available for that check, so complete-app compilation is no longer the local blocker. Installed iPhone offline launch, deployed source/functionality parity and the original whole-screen shaking issue remain unproven.

LIVE, Doomsday, refund staging, original Home Screen app, FIRE Calculator, iPhone Revision 3, iPad Revision 1 and original encrypted backup remain unchanged. No device recovery/reset/storage clearing, deployment, production DB, Stripe or paid action occurred. Official readiness remains **3/10 (30%)**.
