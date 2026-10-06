# FIRE DR — Strict Rendered Parity Queue

Updated: 2026-10-05

Status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`

Master reference: current production LIVE FIRE Business App.

This queue does not replace `PARITY_EVIDENCE_MANIFEST.json`. It orders the remaining work so rendered comparisons happen before speculative redesign or cleanup.

## Rules

- LIVE is the visual/functional master except for owner-approved forward-sync improvements explicitly documented below.
- Do not touch LIVE deployment, DNS, or real customer data while closing DR parity.
- Do not change scrolling/smoothness unless the owner explicitly reopens that issue.
- Do not modify the user-confirmed V14 standalone mobile header/search/welcome spacing unless the owner explicitly reopens it.
- Do not mark a state `VERIFIED_IDENTICAL` from source inspection alone.
- Compare the same state, same content, same viewport/device class, and same theme.
- Record independent evidence before declaring a comparison complete.
- DR-only PIN authentication and D1/no-R2 infrastructure are deployment exceptions; they must not leak into unrelated app UI/functionality.
- Photo-file functionality remains an explicit capability gap until storage exists; do not hide that gap.
- Owner-approved customer-profile forward-sync exception: preserve the richer DR customer profile (Call / Text / Email / Google Maps / Stride / Google Earth / Zillow / property preview plus Edit customer). Do not remove those tools merely to make DR look like an older LIVE customer profile. The intended resolution is to bring LIVE forward to the approved DR customer profile through the LIVE deployment path.

## Priority 1 — owner mobile shell and primary navigation

1. Dashboard light mode.
2. Dashboard dark mode.
3. Top Back / Home / Theme / Menu controls in Home Screen mode.
4. Bottom navigation: Home / Contracts / Customers / Estimates / Schedule.
5. Sidebar/menu open state.
6. Search behavior and visible spacing on iPhone.

Owner-confirmed: V14 top shell is crisp and fixed; search occupies its own second row; the FIRE APP / Welcome block is clear below the header; Stride is acceptable; scrolling is accepted as good enough and frozen.

## Priority 2 — estimates and scheduling

7. New estimate step 1 — customer details.
8. New estimate step 2 — services/pricing.
9. Multi-service estimate.
10. Appreciation discount + additional percent discount.
11. Additional dollar discount.
12. $150 minimum-charge state.
13. Estimate pipeline populated state.
14. Estimate list state.
15. Approved estimate detail before scheduling.
16. Scheduled estimate detail.
17. Schedule Upcoming jobs.
18. Schedule Needs attention.
19. Completed job ready for invoice.

Functional contracts already source-guarded: 50% deposit calculation, approval/signature before scheduling, approved scheduling without a hard deposit gate, accepted-estimate freeze, completed-job report requirement.

## Priority 3 — customer records

20. Customer profile summary.
21. Estimates tab populated + empty.
22. Payments tab populated + empty.
23. Invoices tab populated + empty.
24. Photos controls.
25. Messages tab populated + empty.
26. Notes tab populated + empty.
27. Contact/action row: Call / Text / Email / Maps / Stride / Earth / Zillow.
28. Property preview.

Known LIVE evidence already exists for selected Payments/Invoices/Photos states; those states still need independent captures mapped into the formal ledger.

Owner decision recorded 2026-10-05: the current DR customer section is preferred over the older LIVE customer section. The richer DR profile is an approved forward-sync target, not a defect. Preserve its customer actions, property preview, and Edit customer capability. Exact-parity review of individual customer tabs (Payments, Invoices, Photos, Messages, Notes, Estimates) still applies; the surrounding richer customer-profile shell remains intentionally ahead until LIVE is upgraded to match it.

LIVE forward-sync acceptance criteria for this customer-profile exception:
- Existing customer can be edited in place for name, email, phone, service address, and lead source.
- Saving keeps the same customer record/ID and does not create a duplicate customer.
- Existing estimates, invoices, payments, signed agreements, pricing, and job history are not rewritten.
- Newly added phone/email/address immediately enables the applicable Call / Text / Email / Google Maps / Google Earth / Zillow / property-preview actions after save.
- The richer DR customer shell remains intact; LIVE is brought forward rather than DR being reduced.
- Do not clear any `FORWARD SYNC APPROVED` matrix row until its matching `FORWARD_SYNC_APPROVED.json` entry is deliberately marked `SYNCED_TO_LIVE` after same-device rendered and functional review.

## Priority 4 — customer-facing estimate / approval

29. Estimate document initial state.
30. Service agreement + photo permission + typed signature state.
31. Approved/signed confirmation.
32. Change-request expanded state.
33. Change-request sent confirmation.
34. Invalid/expired/not-found estimate state.
35. Customer Back / Home navigation.

Functional contracts source-guarded: signature essentials, photo permission, contract acceptance, approval notification, pre-approval change requests, fail-closed invalid billing/service data.

## Priority 5 — payments and billing

36. Customer deposit page before approval.
37. Customer deposit page after approval.
38. Deposit recorded state.
39. Customer final-balance state after completion.
40. Payment-success state.
41. Paid-in-full state.
42. Owner Payments — balances to collect.
43. Owner Payments — populated payment history.
44. Record payment modal.
45. Owner overpayment-review state.
46. Customer payment-review state.

Functional contracts source-guarded: deposit obligation before completion, final invoice obligation after completion, no payment during pending refund/open overpayment review, concurrency-safe manual payment insertion.


Owner-approved payment forward-sync addition (2026-10-06): preserve the DR optional tipping flow on final balance card payments. No tip must remain selected by default, with 5% / 10% / 15% / Custom choices. Deposits must never offer a tip. Tip and Tip Refund entries must remain separate from invoice-paid/balance calculations. Bring LIVE forward to this behavior rather than removing tipping from DR.

LIVE tipping forward-sync acceptance criteria:
- Final balance card payment shows No tip / 5% / 10% / 15% / Custom.
- No tip is selected by default.
- Deposit checkout does not offer or accept tipping.
- Stripe shows the tip as a separate Optional tip line item.
- FIRE records the invoice payment and Tip separately.
- Tip and Tip Refund do not alter invoice paid, balance due, paid-in-full, overpayment, or refund-review calculations.
- A Stripe Tip can be refunded as a Tip Refund without reopening an invoice balance.
- Do not clear the tipping `FORWARD SYNC APPROVED` state until LIVE and DR are deliberately reviewed on the same device/profile.

## Priority 6 — invoices

47. Owner Invoices list populated.
48. Invoice customer document.
49. Invoice due-on-receipt state.
50. Invoice specific-date state.
51. Edit final invoice.
52. Add/remove final invoice service.
53. Final invoice percent discount.
54. Final invoice dollar discount.
55. Invoice revision history collapsed.
56. Invoice revision history expanded.
57. Invoice sent/viewed state after edit.
58. Billing-review-required state.
59. Invoice paid-in-full state.
60. Invoice not-found/error state.

Functional contracts source-guarded: one invoice per estimate, final-invoice snapshot, revision history, stale Stripe-session expiration, no invoice reduction below already-recorded payments, pending-refund edit lock.

## Priority 7 — refunds and exceptions

61. Refund modal — Stripe payment.
62. Refund modal — manual payment.
63. Stripe refund processing state.
64. Manual refund confirmation state.
65. Completed refund payment-history row.
66. Pending refund owner state.
67. Pending refund customer invoice state.
68. Keep as overpayment action.
69. Cleared overpayment exception state.

Functional contracts source-guarded: original-payment linkage, remaining-refundable limit, Stripe idempotency, external-refund confirmation for manual methods, negative refund ledger row, invoice reconciliation, explicit retained-overpayment handling.

## Priority 8 — Templates and Business

70. Templates list initial state.
71. Template selected/edit state.
72. Unsaved template changes state.
73. Save template confirmation.
74. Restore default confirmation.
75. Service agreement template.
76. Business overview metrics.
77. Tasks empty/populated states.
78. Add task.
79. Complete/reopen task.
80. Expenses empty/populated states.
81. Add expense.
82. Full records backup controls.
83. Restore missing records confirmation.
84. Restore result message.
85. Export for Wave.

User-confirmed: mobile template selection/edit interaction works acceptably.

## Priority 9 — notifications and error/empty coverage

86. No notifications state.
87. Estimate viewed notification.
88. Estimate accepted notification.
89. Invoice viewed notification.
90. Change requested notification.
91. Payment received notification.
92. Billing exception notification.
93. Mark-one-read.
94. Mark-all-read.
95. Broader loading/empty/error states across owner routes.

## Capability exception — photos in independent DR

The current independent deployment is D1-only and intentionally has no R2 binding. The UI structure can be visually compared, but actual photo-file upload/archive/download cannot be called functionally identical to LIVE until a storage capability is provisioned and tested. The photo API must continue returning a clear unavailable error rather than pretending success.

## Completion gate

Strict parity is complete only when the formal evidence manifest is updated with both LIVE and independent evidence for every required state and each comparison is either `VERIFIED_IDENTICAL` or explicitly classified as an approved infrastructure-only exception. Owner-approved forward-sync product improvements such as the richer DR customer profile do not qualify as `VERIFIED_IDENTICAL` until LIVE is intentionally upgraded to match them; they must remain documented as synchronization work rather than being silently removed from DR.
