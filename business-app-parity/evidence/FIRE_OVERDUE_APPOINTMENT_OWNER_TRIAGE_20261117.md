# FIRE — Overdue appointment follow-up cue is truthful (2026-11-17)

**Executable source + regression:** [commit `2a42a55`](https://github.com/kylebrooks86/first-in-response-website/commit/2a42a555b702dd81d351db981af51f559f4043c9), on the **existing draft, unmerged, undeployed PR #270**.

## Real prior behavior

The actual owner Follow-ups triage (`business-app-parity/shared/lib/follow-up-timing.ts` → `followupUrgency`) used `Math.max(0, Math.ceil((scheduledAt-now)/oneHour))` for an `appointmentReminder`. A scheduled appointment already in the past therefore rendered **"Appointment within 0h"**, and was returned in the `upcoming` bucket, falsely suggesting a future appointment. A status check is warranted; its presence does not establish that the owner contacted the customer or that the job is unfinished.

## Actual code correction

When the saved appointment timestamp is before the review timestamp, `followupUrgency` now returns `past-target`, `Appointment time passed · verify saved job status before contacting`, and urgency rank `2`. Existing upcoming semantics for appointments today/future remain unchanged; unknown or invalid timestamps remain **review-needed** rather than inventing a date. The real `todayActionLane` already puts rank 2 into the owner `now` lane. This only alters an **owner-facing, read-only priority cue**: it does not send reminders, edit scheduled jobs, mutate D1, create payments, issue a refund, schedule recurring tasks, or interpret an appointment as no-show.

## Focused changed behavior coverage

The existing `business-app-parity/shared/scripts/test-followup-triage.mjs` now checks the **actual transpiled helper**, including (1) one millisecond past, (2) four hours past, (3) exactly now retains "within 0h", and (4) past appointment remains actionable in Today's owner queue. The existing future 3h/invalid-date cases and all unrelated contact/financial guards remain. No prior owner tests or screenshots were repeated.

**CI status and release boundary:** On exact appointment source SHA `2a42a555b702dd81d351db981af51f559f4043c9`, initial GitHub Actions were still executing and a later PR push superseded the long staging job; do **NOT** claim 25/25 or the changed triage test PASS until verified on a head including this commit. Separately the previous `7dd6ff0` photo-comparison privacy source completed **25/25 workflow groups SUCCESS**. Canonical **45/95 tasks accepted, 50 open; 4/10 gates accepted (G1/G2/G3/G8), G4/G5/G6/G7/G9/G10 OPEN.** NEW LIVE remains DARK, first true Job #0001 not activated. No Cloudflare login, paid R2/subscription, deployment, merge, D1/Stripe/Access/routes/password mutation, or owner manual test occurred.
