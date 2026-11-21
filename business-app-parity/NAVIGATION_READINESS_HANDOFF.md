# Navigation readiness fix

Base checkpoint: `cd59fbc181a8521ee6ecbc951418fabf675db44b`.

A cold desktop first click failed before hydration under a controlled 600ms entry-browser delay. Shared Dashboard navigation now renders disabled until a mount effect confirms the client handlers are attached. Navigation, Home/Back, menu, theme, owner/payment navigation and search controls share the readiness state. A Loading app status plus a subdued disabled appearance communicate the brief unavailable state. Existing tab navigation and pre-paint scroll reset are retained; customer/financial logic and API/database sources are unchanged.

The native navigation test uses actual Vite/vinext/workerd, disposable synthetic local D1 and actual local auth adapters with synthetic header/signed-cookie fixtures. It verifies one click per desktop action, one Open menu and one Customers click at 320/390px, server-rendered disabled state, Home/Back and scroll reset. No retries, forced clicks or DOM/programmatic menu toggles are used. It waits for the existing quarter-second slide-in transition to finish before measuring button bounds. An early immediate-bound assertion failed during the valid animation and was corrected; no sidebar geometry change was needed.

Final results across all three isolated candidates:

- Navigation readiness: 8/8 each, **24/24** total.
- Full offline Customers runtime regression: 13/13 each, **39/39**, now with its navigation retry loop removed.
- Full application builds: **3/3**. Full-project TypeScript: **3/3**.
- Dashboard financial regression: 69/69 each, **207/207**, synthetic in-memory SQLite only.
- Shared runtime source: **129 files, zero differences**.

The Home/Back test originally used an ambiguous Home selector because both header and customer content have Home buttons; selecting the actual persistent header control resolved the test ambiguity. These were fixture adjustments, not extra product fixes.

This resolves the tested local first-click/menu readiness workflow. It does not establish physical iPhone touch behavior or deployed mobile parity. Slow-loading controls wait until enabled; the implementation prevents unavailable actions rather than treating a pre-hydration click as a save/navigation action. Test timing includes a 600ms network delay, not a real device speed claim.

Bottom-of-screen shaking remains unresolved. No causal link to hydration is claimed. Next bounded batch: collect stationary-bottom scroll/layout samples with synthetic long-content screens, identify a repeatable shared cause before changing scrolling/layout, then validate without clearing or recovering device vaults.

No deployment, production resource/database or Stripe change, paid service, real customer data, device recovery/reset/storage clearing or app deletion occurred. LIVE, Doomsday, refund staging, original Home Screen app, FIRE Calculator, iPhone Revision 3, iPad Revision 1 and original encrypted backup remain unchanged. Official readiness remains **3/10 (30%)**.
