# FIRE Business App — Tulsa-calendar 24-hour appointment reminder truthfulness and SQL-time guard

Date: November 17, 2026 (America/Chicago)  
**Exact executable source/test SHA:** `203a48211fef84a7631a3f46b5f7c79834049dce`  
**Active branch:** `work/fire-main-qa-dr-live-unified-source-20261114`  
**Pull request:** [DRAFT #270](https://github.com/kylebrooks86/first-in-response-website/pull/270), unmerged, no deployment

## Reproduced source defect

The actual owner-saved canned template `appointmentReminder` is labeled **“24-hour appointment reminder”** and says **“Reminder: your service is tomorrow.”** The previous real owner-prepared `POST /api/customer-messages` enforced a *future* scheduled appointment with exact timestamp and owner/customer association, but accepted a job scheduled several days from today. Therefore the canned subject could lie to the customer despite the owner seeing an approved future appointment.

## Real source changes

1. `shared/lib/customer-contact-links.ts`: new pure shared helpers `customerReminderIsTomorrowInTulsa` and `tulsaReminderExpiryUtc`. Compare the **next America/Chicago local calendar date** using `Intl.DateTimeFormat.formatToParts`, not a fixed 24-hour window, browser local zone or guessed UTC-5/6. Calculate the exact next Tulsa midnight as an **ISO UTC** bound that respects DST transitions. `customerAppointmentTemplateReadiness` checks the reminder at display and click time and now also accepts the saved `templateKey` identity, so owner-customized titles and removed placeholders cannot bypass the canned reminder gate; custom messages remain independent.
2. `shared/app/dashboard.tsx`: both real `MessageComposer` calendar-readiness calls now bind `Date.now(),template` rather than judging only the editable template subject/body.
3. `shared/app/api/customer-messages/route.ts`: for `appointmentReminder`, the authenticated owner-only API independently rejects a saved appointment that is not tomorrow in Tulsa (HTTP 409) **before** any message preparation. It captures one wall-clock `appointmentClock` across both that validation and the atomic SQL-time deadline. The actual `INSERT OR IGNORE` adds `AND julianday('now') < julianday(?)` with the precise Tulsa-local midnight expiry, in addition to prior unchanged job schedule/status and recipient guard. A client cannot prepare a new “tomorrow” draft after Tulsa midnight if it crosses during the DB write. No SMS/email provider sends.
4. Existing appointment confirmation and all genuine customer custom/review messages remain supported; new code does not alter payments, Stripe, schema or actual appointments.

## Executable regression checks — source and SQLite

- `shared/scripts/test-customer-contact-ready-actions.mjs`: loads the **actual TypeScript helper**, tests far-future vs next-day vs today, invalid clock/data, customized `appointmentReminder` without subject/date placeholder, appointment confirmation without placeholder, UTC boundaries of **2026-11-01 DST fall back** and **2026-03-08 DST spring forward**, and 1-second before/at Tulsa midnight.
- `shared/scripts/test-customer-message-evidence.mjs`: calls the **actual owner POST** against native synthetic SQLite. Scheduled job five days away produces **409 with zero prepared rows**; a legitimate tomorrow job produces **201**; the actual route SQL contract contains the write-time `julianday('now') < julianday(?)` guard, on top of earlier reschedule, cancelled, invalid-date and different-customer checks.
- The original mandatory staging/native step [Gate 8 saved customer list failure and cache recovery (offline)](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44215516025) **COMPLETED SUCCESS** at the exact source/test SHA after correction of a test-only static assertion still expecting the former variable name `now` instead of shared `appointmentClock`.
- The existing real synthetic Chrome MessageComposer testing step **“Verify declined estimate never shows collectible deposit; test save/readback and geometry”** also **COMPLETED SUCCESS** on that same source/test SHA. No hosted users or devices retested.
- [Exact code SHA checks](https://github.com/kylebrooks86/first-in-response-website/commit/203a48211fef84a7631a3f46b5f7c79834049dce/checks): at evidence construction, **24 of 25** workflow groups SUCCESS, **0 failures**, long staging umbrella still finishing remaining previously accepted Chrome work. Check exact final run before claiming all 25 passed.

## Boundary of proof

This is **working source code plus local Chromium/native SQLite regression**, **NOT** deployed QA/STAGING/DR/NEW LIVE functional proof or owner acceptance. No Git merge, hosted provider Cloudflare/Stripe call, change to account Access/Routes/Workers/Secrets, D1/SQL write, customer communication, live job or upload occurred. [Existing Cloudflare Stripe TEST webhook path proposal](../cloudflare-launch/stripe-test-worker/webhook-path-contract.mjs) remains uninstalled; new Nov17 Access screenshots already preserved separately and must not be requested again.

**Checklist unchanged:** 45 of 95 atomic items completed, 50 remain; 4/10 formal gates accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE remains DARK NO-GO; first genuine Job #0001 reserved.

## Final exact-head CI readback (supersedes prior 24/25 pending)

The executable source/test commit [`203a48211fef84a7631a3f46b5f7c79834049dce`](https://github.com/kylebrooks86/first-in-response-website/commit/203a48211fef84a7631a3f46b5f7c79834049dce/checks) now has **25/25 top-level GitHub Actions workflow groups SUCCESS, zero failed, zero pending**. [Actual staging run #44215516025](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44215516025) **all six jobs SUCCESS**, including the changed actual native SQLite/API 24-hour reminder test, client Tulsa-date/DST logic and original synthetic Chrome MessageComposer. This final exact executable SHA CI result supersedes provisional statements above and the earlier intermediate failed string-only assertion. No hosted target deployment, real Stripe TEST provider event, Cloudflare policy mutation or additional release acceptance is inferred.
