# FIRE App v138 — Strict Look + Function Parity Matrix

## Completion rule
The LIVE FIRE App and independent FIRE App are not allowed to be called identical until every shared user-facing state is either VERIFIED IDENTICAL or explicitly documented as an infrastructure-only difference with no user-visible behavioral effect.

Status meanings:
- VERIFIED IDENTICAL — live reference exists and the independent implementation has been matched to it.
- FUNCTIONALLY VERIFIED — behavior is covered by regression/safety checks, but exact live visual state has not yet been captured and compared.
- NEEDS LIVE VISUAL — implementation exists, but a corresponding live screenshot/state is still required before identical can be claimed.
- INFRASTRUCTURE ONLY — intentionally different implementation detail that must not alter visible or business behavior.
- CAPABILITY GAP — intentionally unavailable in the current DR deployment; it cannot be called functionally identical until provisioned/tested or explicitly accepted as out of scope.

## Owner app
| Area / state | Status | Evidence / blocker |
|---|---|---|
| Global FIRE navy/red visual system | VERIFIED IDENTICAL | Matched to supplied LIVE v49 references. |
| Top header: Back / Home / Theme / Menu | VERIFIED IDENTICAL | Supplied LIVE references; current independent V14 mobile shell is user-confirmed good after deployment. |
| Notification control and popup | VERIFIED IDENTICAL | Supplied LIVE references. |
| Mobile bottom nav | VERIFIED IDENTICAL | Home / Contracts / Customers / Estimates / Schedule. |
| Drawer navigation | VERIFIED IDENTICAL | Supplied LIVE references including Dashboard label and owner footer. |
| Home dashboard cards | VERIFIED IDENTICAL | Supplied LIVE references. |
| Home recent estimates | VERIFIED IDENTICAL | Visual match plus multi-service duplicate regression coverage. |
| Home quick actions | VERIFIED IDENTICAL | Supplied LIVE references. |
| Contracts list | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customers list | VERIFIED IDENTICAL | Supplied LIVE references. |
| Add customer modal | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customer detail property/map block | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customer Messages tab | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customer Notes tab | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customer Payments tab | LIVE EVIDENCE CAPTURED | Exact LIVE empty/populated behavior captured; independent rendered comparison still pending. |
| Customer Invoices tab | LIVE EVIDENCE CAPTURED | Exact LIVE empty state captured; independent rendered comparison still pending. |
| Customer Photos tab | LIVE EVIDENCE CAPTURED | Exact LIVE controls/dropdown captured; independent rendered comparison still pending. |
| Estimates pipeline | VERIFIED IDENTICAL | Supplied LIVE references; exact stage ordering locked. |
| Estimates list mode | VERIFIED IDENTICAL | Supplied LIVE references. |
| Estimate detail | VERIFIED IDENTICAL | Supplied LIVE references. |
| Edit estimate multi-service modal | VERIFIED IDENTICAL | Supplied LIVE references. |
| Service selector ordering/options | VERIFIED IDENTICAL for captured catalog | Captured LIVE dropdown; retained Seasonal/Holiday Lighting, Commercial Exterior Cleaning, Specialty Exterior Service, Custom Service. |
| Estimate detail Deposit / Paid / Balance labels | VERIFIED IDENTICAL | Corrected from v25 onward. |
| Job date picker interaction | VERIFIED IDENTICAL for iPhone reference | Native iOS picker captured in LIVE. |
| 50% deposit scheduling rule | LIVE BEHAVIOR CAPTURED | Current LIVE allows an approved job to be Scheduled with Paid $0 while still displaying the 50% deposit. Independent mechanics align; rendered independent evidence is still required. |
| Schedule Needs attention | VERIFIED IDENTICAL | Supplied LIVE references. |
| Schedule Upcoming jobs / empty state | VERIFIED IDENTICAL | Supplied LIVE references. |
| Follow-ups dashboard | VERIFIED IDENTICAL | Supplied LIVE references. |
| Follow-up prepare-message workflow | FUNCTIONALLY VERIFIED | Core behavior tested; additional exact live message-state screenshots would strengthen visual proof. |
| Payments dashboard | VERIFIED IDENTICAL | Supplied LIVE references. |
| Record payment modal | VERIFIED IDENTICAL | Supplied LIVE references including Cash App/Venmo. |
| Payment history | FUNCTIONALLY VERIFIED | Duplicate prevention tested; exact populated LIVE history screen still needed. |
| Refund payment modal / payment-level refund workflow | NEEDS LIVE VISUAL | Functionality is source/regression-guarded; exact LIVE owner refund UI must be captured and compared. |
| Refund processing hold across owner job/invoice/payment views | NEEDS LIVE VISUAL | Behavior is source/regression-guarded; exact LIVE rendered hold state remains to be compared. |
| Invoices list | NEEDS LIVE VISUAL | Functional/multi-service behavior audited; exact LIVE screen still needed. |
| Invoice detail owner view | NEEDS LIVE VISUAL | Exact LIVE state not yet captured. |
| Business screen | NEEDS LIVE VISUAL | Exact LIVE screen not yet captured. |
| Templates screen | NEEDS LIVE VISUAL | Exact LIVE screen not yet captured. |
| Job costs & profit modal | VERIFIED IDENTICAL | Supplied LIVE references. |
| Service completion report | VERIFIED IDENTICAL | Supplied LIVE references including all six checks. |
| Job report saved state | VERIFIED IDENTICAL | Supplied LIVE reference. |
| Before/after photos UI/workflow controls | LIVE EVIDENCE CAPTURED | LIVE controls captured; independent rendered UI comparison still pending. Actual DR photo-file storage is separate capability gap below. |
| Empty/error states across all owner routes | FUNCTIONALLY VERIFIED / NEEDS LIVE VISUAL | Regression behavior exists; not every live visual error/empty state has been captured. |

## Customer-facing app
| Area / state | Status | Evidence / blocker |
|---|---|---|
| Customer estimate header/body | VERIFIED IDENTICAL for captured estimate | Supplied LIVE references. |
| Multi-service estimate presentation | VERIFIED IDENTICAL for captured structure | All lines + subtotal/discount + total/deposit blocks matched. |
| Service Agreement / Liability Waiver sections | VERIFIED IDENTICAL for captured sections | Supplied LIVE references. |
| Customer Back / Home floating controls | VERIFIED IDENTICAL | Supplied LIVE references. |
| Customer approval/signature flow | FUNCTIONALLY VERIFIED | Exact full live signature lifecycle still needs complete visual capture. |
| Change-request flow | FUNCTIONALLY VERIFIED | Needs exact live visual states. |
| Customer invoice view | LIVE EVIDENCE CAPTURED | LIVE invoice page captured for due-on-receipt and dated-due states; independent rendered comparison still pending. |
| Customer payment page | NEEDS LIVE VISUAL | Multi-service behavior fixed; exact LIVE page not yet captured. |
| Stripe checkout initiation | FUNCTIONALLY VERIFIED in code | LIVE Stripe not yet proven synchronized/tested. |
| Stripe webhook completion | FUNCTIONALLY VERIFIED in independent code | LIVE implementation/test-mode proof required for identical status. |
| Cash App instructions | VERIFIED IDENTICAL for captured wording | `$FIREExteriors`. |
| Venmo instructions | VERIFIED IDENTICAL for captured wording | `@FirstInResponseExteriors`. |
| Paid invoice / zero-balance customer state | NEEDS LIVE VISUAL | No exact LIVE reference yet. |
| Customer refund-processing state | NEEDS LIVE VISUAL | Customer estimate/invoice wording and payment suppression are regression-covered; exact LIVE render is still required. |
| Customer error/expired-link states | NEEDS LIVE VISUAL | Must capture/compare before literal identical claim. |

## Shared business behavior
| Behavior | Status | Notes |
|---|---|---|
| Multi-service calculations | FUNCTIONALLY VERIFIED | Server-side totals, discount, total and deposit validation. LIVE sync still required. |
| No duplicate parent rows from estimate_items joins | FUNCTIONALLY VERIFIED | Regression coverage for Home/invoices/payments/expenses/etc. LIVE sync still required. |
| $150 minimum logic | FUNCTIONALLY VERIFIED | Locked independent safety rule; confirm LIVE equivalent after sync. |
| Service catalog/pricing rules | FUNCTIONALLY VERIFIED | Known rates locked; unverified services remain intentional manual pricing. |
| 50% deposit requirement | LIVE BEHAVIOR CAPTURED | LIVE calculates/displays the 50% deposit but does not use it as a scheduling gate. Independent mechanics match; independent rendered evidence is still required. |
| Completion-before-final-balance workflow | FUNCTIONALLY VERIFIED | Independent regression coverage; LIVE sync required. |
| Stripe server-side amount calculation | FUNCTIONALLY VERIFIED | Independent side only until LIVE sync verified. |
| Stripe signed webhook + idempotency | FUNCTIONALLY VERIFIED | Independent side only until LIVE sync verified. |
| Manual payment safeguards | FUNCTIONALLY VERIFIED | Regression coverage. |
| Backup/restore behavior | INFRASTRUCTURE ONLY | Independent recovery capability; must not alter shared business UX. |
| Owner authentication implementation | INFRASTRUCTURE ONLY | DR uses a separate 4-digit PIN implementation; post-login FIRE experience must match. |
| Database/resource IDs | INFRASTRUCTURE ONLY | Expected difference. |
| Domain/host URL | INFRASTRUCTURE ONLY | Expected difference. |
| Stripe test/live secrets | INFRASTRUCTURE ONLY | Expected difference; resulting FIRE workflow must remain the same. |
| Photo-file storage in current DR | CAPABILITY GAP | Current independent staging is intentionally D1-only with no R2. Photo UI can be visually compared, but upload/archive/download cannot be called functionally identical. The photo API must fail closed until storage is intentionally provisioned and tested. |

## Current strict-parity verdict
**NOT YET IDENTICAL IN EVERY SINGLE LOOK/FUNCTION STATE.**

The known/captured LIVE surfaces are highly matched, but literal parity is blocked until the remaining visual states are captured on the missing side, independent evidence is formally registered, and the current shared release rules are synchronized and verified in LIVE. The no-R2 photo-file capability gap also prevents a claim of full photo-recovery equivalence unless later provisioned/tested or explicitly accepted as out of scope.

## Next evidence work — independent DR side first
These already have LIVE evidence. Do **not** recapture LIVE merely to satisfy parity; capture/register the matching DR state:
1. Customer Payments tab.
2. Customer Invoices tab.
3. Customer Photos tab.
4. Customer-facing invoice view — due on receipt.
5. Customer-facing invoice view — specific due date.
6. 50% deposit scheduling state with Paid $0.
7. Before/after photo workflow controls.
8. Captured service-selector/catalog state.
9. Approved/signed customer confirmation state.
10. Completion → Create invoice → Invoice created / Send invoice transition.

## Next evidence work — new LIVE visuals still needed
1. Owner Invoices list.
2. One owner invoice detail.
3. Customer standalone payment page, including partial/full balance if available.
4. Templates screen.
5. Business screen.
6. Approval/signature lifecycle states not already represented by the captured approved/signed evidence.
7. Change-request state.
8. Populated Payment History.
9. Customer expired-link/error page.
10. Refund payment modal/workflow.
11. Owner refund-processing hold state.
12. Customer refund-processing state.
13. Paid invoice / zero-balance customer state.
14. Broader owner empty/error states not already represented by the current formal capture.

No release may claim FULL IDENTICAL until these blockers are closed or proven unreachable/nonexistent in both deployments, and any capability gap is resolved or explicitly approved as an infrastructure-only exception.
