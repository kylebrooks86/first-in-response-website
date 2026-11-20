# Candidate-only layout trace

Base checkpoint: `0aafe3250d379720c26d95394e00bea13593afe1`.

## Functionality

The isolated authenticated dashboard now has a collapsed layout diagnostic panel behind the existing `localCustomersCandidate` server gate: development mode and the exact synthetic-only feature flag. It does not appear by default or in production mode. The same component, recorder, Dashboard integration and scoped styles are copied to all three candidates.

Start captures only numeric geometry (scroll position, document height, viewport/visual viewport size and offset, header and last customer positions) and a bounded list of scroll/resize event types and elapsed times. Stop produces a read-only in-memory JSON report. Discard removes that report. No automatic upload, persistent storage, record text, account identity, phrase, URL or user-agent collection is performed. Frames are sampled at most every 100 milliseconds and capped at 201; events are capped at 600. Capture ends after 20 seconds, on document hiding, or on component unmount. No capture-time React frame updates are used.

The panel itself occupies layout space when opened and its controls affect scroll position when clicked. It is therefore an observation aid, not a neutral proof of original-layout behavior; comparisons should include uncaptured runs. It does not change app scroll handlers or viewport-height rules.

## Verification

Actual Vite/workerd development servers use disposable local D1 databases seeded with 48 synthetic Customers and disposable Chromium profiles. Separate gateway and signed-session authentication adapters are exercised with synthetic sessions. Browser results and limits are recorded in `LAYOUT_TRACE_EVIDENCE.json`.

Coverage includes manual stop with numeric-only report fields and unchanged localStorage, discard, automatic timeout and sample/event limits, navigation cleanup, a simulated hidden-document visibility event, restarting capture, diagnostic controls at three widths in light/dark themes, stationary bottom, wheel input at bottom, and controlled viewport resizing. Hidden-page behavior uses an explicit synthetic visibility event; it is not physical Safari backgrounding evidence. Record count remains intact and external browser requests are blocked.

Full builds and TypeScript checks are run for all three candidates. Financial regression uses in-memory synthetic SQLite. Source parity excludes reviewed target-specific deployment/authentication adapters. Initial browser runs failed on a test selector that incorrectly treated an existing strong label as a heading; the locator was corrected and final suites rerun. No application workaround was added for that test error.

## Blockers and next priority

Bottom-of-screen shaking remains UNRESOLVED; Chromium testing and controlled viewport resizing do not reproduce Safari dynamic chrome, physical touch or elastic overscroll. Existing shared CSS includes 100vh minimum-height rules and a 100dvh modal cap; their presence does not establish causation. No unsupported viewport CSS fix is included.

No deployment, production activation, migrations, Stripe actions, real record access or device recovery occurred. The iPhone Revision 3 vault, iPad Revision 1 vault, encrypted backup, original Home Screen apps and FIRE Calculator remain untouched.

Next bounded batch: review candidate offline Customers pending-save/conflict presentation against the repository contract and close one verified gap without automatic server writes. The trace is ready for a separately approved future Safari test; no device action is needed for this checkpoint.

Official release readiness remains **30% (3/10 gates)**. Candidate verification is not deployed acceptance.
