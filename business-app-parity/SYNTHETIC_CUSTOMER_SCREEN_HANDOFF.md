# Complete synthetic Customers review screen

Base checkpoint: `27dd5b67f4319b70a5272e31ec8039e0d2bf3585`.

The isolated screen now joins the encrypted repository, identity/lifecycle controller and Customers view in a responsive light/dark shell. It provides an explicit new test-vault form, contact creation/editing, current revisions, local operation receipts, save status and lock handling. The dedicated account `synthetic-screen-preview` and target `synthetic-screen-only-v1` do not use the existing device demonstration namespace. On first visit the storage connection can be opened but no snapshot is seeded. Only the explicit form initializes an empty synthetic snapshot; atomic add rejects existing snapshots. Existing test vaults hide the creation form and remain locked until the test phrase is entered. No backup restore is implemented.

## Run locally

From any isolated candidate root, with TypeScript installed:

```sh
node scripts/serve-synthetic-customer-preview.mjs
```

The server prints its ephemeral localhost URL and binds only `127.0.0.1`. `FIRE_SYNTHETIC_PREVIEW_PORT` optionally chooses a port. This is a local review server, not a deployment command. It transpiles only the isolated modules in memory, serves no Business App/API/worker routes, uses self-only script/style policy and no-store caching. No external fonts, assets or packages are requested by the browser. A TypeScript tool dependency is needed by the local server; complete Business App dependencies are not required to review this standalone screen.

## Verified results

Native Chromium 153.0.8010.0 with real IndexedDB/WebCrypto: **22/22 checks per candidate, 66/66 total**. Focused strict TypeScript: **3/3**. Existing shared runtime gate: **125 files, zero differences**. Five new preview/tool files also byte-match all three candidates; the runtime gate does not inventory the preview folder or scripts.

Checks cover explicit empty fixture creation, hidden locked contacts, synthetic create/edit, pending receipts, offline editing after loading, encrypted persistence on reload, no overwrite form for an existing vault, scoped routes, no service worker/external requests/script errors, keyboard focus/labels, touch controls at least 44px, four viewport widths in both themes, narrow editor layout and tested text contrast at least 4.5:1. Long synthetic values wrap. The sticky header stays at the viewport top when scrolled to the bottom.

Final 390px screenshots in `review-images/customers-mobile-light.png` and `customers-mobile-dark.png` were visually inspected. Capture scroll position was reset before full-page screenshots to avoid Chromium placing fixed/sticky elements at the previous scroll offset in the capture. These are Chromium review images, not physical iPhone screenshots or proof of original app visual parity. The original whole-screen shaking issue remains unresolved.

## Remaining integration work

Real authentication/target mapping, complete Business App compilation and route integration remain unverified. Financial collections retain connection-required messaging; no estimates/invoices/payments/photos/notes totals are fabricated. The screen is not imported into Dashboard, app routes or deployment files, and does not register an offline shell. Loaded-screen offline editing is proven locally; offline cold launch is not.

Next bounded batch: resolve full-app local build dependency availability and verify a stable opaque account ID plus fixed target mapping from the real server authentication adapters before isolated Customers route integration. Preserve existing online workflows until those checks pass.

No deployment, real customer connection, Stripe action, production database write or paid service was used. LIVE, Doomsday, refund staging, original Home Screen app, FIRE Calculator, both device vaults and original encrypted backup are unchanged. No device recovery attempt occurred. Official readiness remains **3/10 (30%)**.
