# FIRE – owner-confirmed booking promotion, isolated source candidate

Origin: development branch `work/fire-business-app-parity-2026-10-08` at `27cd90f96eb9ed25606fa32fd957821b22b51103` (prior fully green 8/8 CI `39838903382`). Implementation branch `work/fire-booking-promotion-attestation-2026-10-22`, for isolated work only.

## Intended owner workflow
When creating a **new** estimate, the owner can check **Customer booking already confirmed** and select the booking's actual Tulsa-local calendar date. The app rechecks current saved promotion definitions and can apply qualifying booking-dependent promotions **alongside** estimate-date, service bundles, and eligible appreciation savings, honoring the financial caps, $150 minimum, exact-cent pricing, and 50% deposit. Removing the date or changing services/subtotal invalidates that verification until recalculated. A date outside the offer window does **not** earn the offer.

The server checks that a booking date is a valid calendar date and not later than the current Tulsa date, that catalog revision/rule IDs/current scope and final price match, and that the owner is authenticated. The owner explicitly attests the booking date: this is **not an independently verified customer booking receipt**, a signed agreement, or a new schedule entry. Staff should only enter dates supported by actual communications or other available records. Historical source rules and the asserted booking date are stored with the original estimate attribution in the same atomic write; older records without the new field continue to work.

Example: confirmed October 2026 booking within the 15% promotion dates + $25 house-and-gutters discount on $460 produces $366 customer total and $183 deposit, even when the **work date is later**. This does not modify any old signed/paid quote or create a payment. Where booking occurs after a quote is already sent/accepted, use the reviewed customer amendment workflow; this candidate does not silently change accepted terms.

## Coverage and release limits
Automated tests exercise: true vs missing booking date, invalid and future dates, before-window dates, automatic stacking, removed confirmation, frozen owner history, tampered rule IDs, booked evidence rejection without writes, accepted/signed repricing protections, normal legacy discounts, mobile 320/390/768 light and dark state changes, and existing quote/default pricing regressions. All synthetic, no hosted writes. Branch CI may include full app QA and independent candidate builds, none of which deploy.

No hosted migration or production merge, no real customer data, no payment actions and no customer messaging. Release acceptance still 3/10; physical device and separate production authorization remain necessary.
