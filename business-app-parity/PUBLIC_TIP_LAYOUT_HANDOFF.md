# Public final-tip layout batch — October 8 Chicago / October 9 UTC

Parent checkpoint a610baab8fae6a8bbe094273ee592e1ba91c3fd7. Fresh GitHub fetch at start and before saving matched local HEAD. Canonical checkout was clean. Existing LIVE local evidence was preserved.

## Confirmed difference and isolated fix

Existing hosted synthetic staging invoice (Sites version 3) was reachable again. At 1363px viewport, the approved tip grid has two 311px columns, Custom spans 1 / -1, and there is no document-wide horizontal overflow. Read-only DOM and screenshot evidence are saved in TIP_LAYOUT_BROWSER_EVIDENCE.json and evidence/fire-tip-baseline-20261009.jpg. These describe the older deployed staging build; they do not identify the candidate's deployed commit.

Candidate source had a min-width:640px override that changed invoice tips to five columns with Custom in one column. Its shared component on the standalone /pay page used older five-column or small-screen three-column styling because the richer approved styles were restricted to .invoice-portal. Those are verified stylesheet differences, not reported iPhone observations.

Changed shared/app/globals.css identically in isolated LIVE, independent DR and staging candidates:

- Use two tip columns and full-width Custom at all widths, matching the approved hosted reference and supplied screenshots.
- Apply the approved rounded white card, heart heading, two-line option labels/amounts, selected red styling and sizing to the shared final-tip component on both invoice and payment routes.
- Remove conflicting five-column/three-column breakpoint overrides. No unrelated page width, invoice padding, payment history, manual business links or navigation changed.

No TSX, tip mathematics, invoice principal, API/refund/reconciliation code, customer data, migration, authentication, source dependencies or Stripe credentials changed.

## Tests and limitations

New test-public-tip-layout.mjs: 16/16 contracts per target, 48/48 executions. It parses actual CSS and resolves relevant rules at 320/375/390/430/520/640/1363px for .invoice-portal and .pay-card. Requires two columns, full-width Custom, approved card/button styling, common final-only component and default No tip. A deliberately reintroduced desktop override is detected as conflicting. This is a CSS contract resolver, not a browser engine.

Selected suites 9/9: new layout contracts, actual final-tip interaction/checkout-request regression, and prior payment mobile UI regression in each of three candidates. Framework builds 3/3. Shared app source 118/118 hashes match; nine hosting/authentication adapters still require verification. New script separately synchronized to all targets. The DR /login static-classification warning remains unchanged and builds succeeded.

TypeScript was not rerun because runtime change is CSS-only; prior 3/3 results are preserved. Unchanged 57 photo recovery checks were not rerun. No real charge/refund or checkout request was made.

Hosted browser checks were transient local UI only: opened Custom, inspected its 16px decimal input and $7.50 tip/$107.50 charge alongside unchanged $100 invoice principal, then restored No tip. Neither Pay nor manual external payment links was clicked. Those basic interactions were already known; the new evidence motivating this fix is the current computed two-column grid and candidate's conflicting breakpoint.

Browser API exposes no supported viewport-resize/device-emulation control. No local preview was improvised because the managed Sites control-browser skill is unavailable. Consequently candidate rendered comparison, iPhone widths, light/dark mobile screenshots, Doomsday comparison and hosted Stripe integration remain unverified. The saved screenshot is desktop-only and not counted as formal mobile parity.

## Saved local candidates

LIVE 8324fc877112686ccdefa9baabad32f3c06627a7.
Independent DR 3e68722538cab64bbc662361c6cc0c15d5cee4d1.
Staging 4b5740cfcf2e74e80b2bff774eb6d79a870a69d5.
Shared branch work/fire-business-app-parity-2026-10-08; see containing commit for this batch.

No production/staging deployment, database write/migration, secrets change, storage provisioning or paid service occurred. Existing LIVE/DR deployments, data and rollback copies remain unchanged. Hosted version 3 does not include the latest candidate patches.

## Progress and next batch

Bounded implementation 2/2 (100%); selected suites 9/9 (100%); new contracts 48/48 (100%); builds 3/3 (100%); candidate shared-source parity 118/118 (100%). Overall formal LIVE/DR functional and visual comparisons remain 0/32 (0%); remote schema/journal verification 0/3 (0%); production-readiness gates remain 3/10 (30%), NOT READY.

Next bounded batch should verify isolated hosting/database/sandbox routing and rollback readiness before preparing an authorized staging update, then collect real mobile light/dark evidence for invoice and /pay tip cards. Do not use the observed sandbox endpoint pointing to LIVE or replay real events. Exact Doomsday deployed identity/schema, secure authentication recovery and independent photo storage remain blocked/unverified from prior checkpoints. No owner intervention is needed to preserve this batch.

## Read-only independent QC handoff

Review the CSS diff for shared two-column/full-width Custom styling, the sixteen layout contract checks and saved desktop reference. Confirm the standalone payment page uses the shared PayButton, final-only visibility and all financial/API/schema source stayed unchanged, and flag any cascade effects needing a browser engine. Do not modify shared branches, deployments, databases or Stripe. This batch stops after saving.
