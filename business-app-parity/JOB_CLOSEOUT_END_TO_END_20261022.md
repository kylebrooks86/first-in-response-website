# Closeout entry-point consistency and complete owner workflow

Continues verified development commit 027233fa0490e2fce284ddd5bef532d9e0dbf622 (CI 39777447725, 8/8 jobs passed).

Implemented in shared source:
- Job review shortcuts require a positive safe-integer billing total, exact paid principal, explicit zero refund/checkout/overpayment holds, and no confirmed review request or owner-received flag. A saved send/received flag becomes a truthful non-interactive status instead of another outreach control.
- Estimate list, focused history and customer job queries return the same read-only refund/checkout/received-review metadata. Legacy text/email entries do not become proof of an owner-confirmed review send.
- Dashboard review checks open the exact existing customer review activity and request focus there.
- Changing the composer customer/job clears prior edited text, feedback, preparation state and document links; normal close/reopen on the same customer keeps existing behavior. Body regeneration also keys on customer/job even if two customers share the same first name. Message type now has an associated accessible label.

Validation additions:
- Actual JSX shortcut guard executed against exact/revised totals, zero/fractional/unsafe totals, holds, unknown metadata and already tracked reviews.
- Actual three owner API routes exercised on disposable SQLite: consistent holds/flags, no legacy/prepared false confirmation, customer isolation, no writes, auth before DB.
- Existing real React/Radix closeout browser fixture now switches customers with an edited private draft in mobile light/dark mode and verifies fresh message text and the new job's estimate URL, without a write or external message.
- New `--job-closeout` built-Worker workflow uses actual authenticated local HTTPS, native D1 and the full app: save completed report, mark job complete, record final payment, resume prepared review, explicitly confirm send, check saved queue removal, backdate ONLY a disposable synthetic receipt to exercise due timing, follow the Dashboard reminder to the exact customer check, prepare and explicitly save the existing received-review note, then verify cleared reminders/received status and unchanged financial/signature records.
- External SMS dispatch is avoided: native workflow prepares a synthetic message via the actual owner API and resumes it in the actual composer. Other browser fixtures separately exercise the template and capture external handoffs. This is not physical iPhone acceptance.

No hosted database writes, migration, deployment, real payments, messages or customer changes. Existing owner backup restoration and 23-to-25 rehearsal are not repeated. Private backup retention, authenticated Cloudflare provenance, exact separate migration/publication approvals and physical iPhone checks remain release blockers. Production acceptance stays 3/10 gates (30%).

Consult the exact candidate's finished CI run for rendered/browser and full built-Worker results; local compilation or handler tests alone do not establish those passes. Next bounded work: cross-device freshness and interrupted review-record recovery, then exact approved QA release preparation.
