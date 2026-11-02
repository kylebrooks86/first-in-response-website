# FIRE Business App — exact-target QA safety review, November 2, 2026

**Decision: NO DEPLOY. Source-only review packet.** This file is not authorization to use Wrangler against any environment. Release gate count remains **3 of 10 accepted**. PR #84 contains combined owner-only estimate Void, signed-only customer payment guidance and customer POST request-shape security, with no DB migrations.

## Prior accepted isolated QA checkpoint — reference only, MUST reconfirm before deploying

| Property | Prior owner-reported QA evidence |
| --- | --- |
| Worker | `fire-fullapp-qa-20261016` |
| D1 binding name | `DB` |
| Dedicated QA D1 UUID | `8ccfb1f8-1657-4074-b1b2-47de78f95003` |
| Published source | `a193a571f0164231659b157584c350bc0506bb9b` |
| Published Worker version | `86f3d186-2770-438e-9f5c-32319bf6fe1d` |
| Prior rollback Worker version | `99fa8c27-df83-48d3-b953-9a84eb295334` |
| R2 photo binding | Not present |
| Stripe mode | All Stripe operations intentionally disabled in QA |

**These are historical owner-supplied facts, not proof of the Worker/D1's current active values.** Reuse valid prior QA backups and migration/owner login checks, but never use old values blindly in a deploy command.

## Source to consider

Draft stacked PR #84, `work/fire-release-integrated-safety-2026-11-02`, whose exact full commit SHA **must be refreshed and compared to passing GitHub Actions immediately before any QA preflight/deploy**. Do not treat the PR merge commit or PR #82/#83 independent green CI as deployed. PR #84 is draft/unmerged. Ensure the full shared source is materially identical to the accepted QA candidate except the reviewed changes; source compilation and CI alone do not establish this.

## SAFE preflight required before separately requesting QA deploy approval

1. Read-only authenticated Cloudflare check: exact Worker name, current version UUID, percentage routed, original rollback UUID, `DB` immutable physical D1 UUID, no R2, no secrets displayed, no Stripe keys. **STOP** if mismatch or provider read unavailable.
2. Verify read-only migration journal and schema against existing 25-migration QA evidence; **NO migration applied** just to test the new Void feature. Verify `payment_refunds`, checkout and job-report dependency tables exist in the precise QA target. **STOP** if not.
3. Produce a local reproducible candidate build from the **exact reviewed full commit SHA**, check expected file hashes, verify Cloudflare configuration remains QA-only, static browser test/CI all green, and retain current Worker version for rollback.
4. Present the precise expected target, source SHA, unchanged D1 UUID, current and rollback version IDs, payload/file differences, risk of callback/notifications, and all prohibited actions for **separate owner approval**. No "approve if safe" inferred from prior unrelated TEST approval.
5. Only after approval, deploy **CODE ONLY** to the verified QA Worker; never touch LIVE, Doomsday, Sites staging/refund app, independent Stripe TEST, DNS, Access, physical database bindings, migrations, secrets, paid services, R2, or existing LIVE payments.

## Focused device smoke AFTER separately approved QA-only code deployment

- On existing isolated QA synthetic records, confirm the **Void unaccepted estimate** action exists only on unsigned/unscheduled/unpaid quotes, requires explicit confirmation and moves the quote to Lost without erasing history. Use a *dedicated* synthetic draft only with separate permission to create/change QA data.
- With a controlled unsigned QA sample, confirm manual Cash App/Venmo instructions are absent. After a signed-approval fixture, confirm appropriate instructions only for remaining balance, but **do not issue payment or real notifications**.
- Browser origin/JSON/size/whitelist guard: exercise local/fake HTTP request tests or an isolated already-approved synthetic token, never open a broad production Access bypass. A QA owner-only Access login is not a customer anonymity test.
- Reopen affected record after refresh and confirm saved status; one iPhone navigation/close and no erroneous invoice/payment behavior.
- **Do not repeat** previously owner-passed Google Voice real messaging, saved customer editing, photo archive, JWT/JWKS, or the separate isolated Stripe TEST signed-estimate proof. No fabricated unread notifications or customer messages.

## Release blockers this packet does NOT resolve

Gate 4 actual LIVE provider deployment/physical D1 isolation, Gate 5 current LIVE refund schema/journal, Gate 6 safe customer POST routes and exact hosted candidate, Gate 7 restorable production target data+uploads, Gate 8 QA acceptance, Gate 9 distinct Stripe webhook/refund sandbox accounting, Gate 10 frozen artifacts and explicit production cutover approval. Only Gate 1–3 are formally accepted. **NO-GO until independent evidence and owner authorization.**
