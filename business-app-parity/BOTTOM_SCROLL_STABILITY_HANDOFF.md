# Bottom scroll stability diagnostic

Base checkpoint: `b894bf616f25aca403c377646f870bb124087fb3`.

Added a repeatable actual-framework browser diagnostic with 48 synthetic Customers in disposable local database fixtures. All three candidates passed 23/23 checks (69/69 total), including 18 scroll cases each (54 total). Widths: 320, 390 and 768 pixels; light/dark themes; stationary bottom, wheel input at bottom, and viewport height changes from 844 to 724 and back. Each final case samples 90 animation frames, for 4,860 final-case frame samples across candidates. The evidence stores ranges and first/last frames, not full traces.

Measured maximum within-sample movement was zero pixels for scroll position, document height, viewport/visual viewport height, header position and final customer position. No horizontal overflow, external browser requests or runtime errors were observed; all 48 synthetic records remained intact. Synthetic sessions exercise the separate gateway and independent signed-session adapters.

The reported device shaking remains UNRESOLVED. Physical Safari was not tested; controlled viewport resizing is not equivalent to Safari dynamic toolbar movement or touch elastic overscroll. No application layout fix is justified by these results, and application source was unchanged. This diagnostic narrows the reproduction gap and supplies a regression harness, not a completed release gate.

Validation: all three browser diagnostic processes exited 0. Script syntax and source parity are checked at checkpoint. The prior checkpoint's 3/3 application builds, 3/3 TypeScript checks and 207/207 financial regressions remain historical evidence; they are not claimed as newly rerun for this script/documentation-only batch.

Run from each isolated candidate: `FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE=<playwright module path> FIRE_BROWSER_TEST_EXECUTABLE=<Chromium executable> node scripts/test-bottom-scroll-stability-framework.mjs`. Requires installed candidate dependencies. Fixtures and the browser profile are created and removed by the harness; existing device/browser vaults are never opened.

Next priority: inspect viewport-height dependencies and prepare a read-only Safari layout trace for a future approved physical reproduction. Preserve the original Home Screen apps and iPhone Revision 3/iPad Revision 1 vaults. No deployment, activation, recovery, storage clearing, Stripe operation or production database access occurred.

Official full Business App release readiness remains **30% (3/10 gates)**.
