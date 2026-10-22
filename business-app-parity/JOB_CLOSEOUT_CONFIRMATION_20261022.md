# Closeout confirmation and recovery candidate

Continues ab333d5514ae68d6f902ab26bd521b2ad30a57ab; preserves the existing Center, saved records, migrations, financial eligibility, review URL, message writers and received-review note writer.

Implemented:
- Verify the exact confirmation receipt: immutable prepared-message identity, customer, job, template, body, channel and timestamp. A malformed or mismatched reply retains the prepared message for an explicit idempotent retry.
- Share a synchronous mutation lock across preparation, confirmation and discard. Duplicate confirmation taps cannot issue competing writes. Keep the dialog open while saving.
- Reject late preparation/confirmation/discard replies after the customer/job scope changes or unmounts. A failed post-save refresh is reported as a saved confirmation needing refresh, rather than an unconfirmed write.
- Refresh attention after verified preparation, so other open queues can show prepared versus confirmed status accurately.
- Recognize exact linked unsent-draft cancellations in the read-only paid queue. A discarded draft returns to ready unless another active prepared message exists; both audit events remain unchanged.
- Label request and status-check snoozes separately in both customer timeline and message history, without claiming a send or received review.
- Keep mobile message and confirmation controls at least 44px tall, with wrapping and a 16px narrow-phone textarea.

Validation:
- New source-extracted actual confirmation-handler regression tests cover seven mismatched receipt fields, missing/error/offline responses, synchronous duplicate taps, stale scope responses and failed refresh callbacks.
- Existing Chrome closeout fixture now includes actual MessageComposer/Radix controls and actual customer-message/note/review-check APIs over disposable SQLite. Tests connect preparation, confirmed send, immutable retries, waiting/due/received states and reminder removal in light/dark iPhone-sized views.
- Completion/payment transitions in that fixture are synthetic ledger setup; these assertions do not constitute completion/payment UI or physical iPhone acceptance.
- The same API lifecycle can run locally with `node --experimental-sqlite scripts/test-job-closeout-center-browser.mjs --api-only`. `--compile-only` compiles fixtures without asserting rendered behavior.
- GitHub Actions runs the new handler regressions and expanded existing browser suite. Consult the exact candidate's completed run before claiming CI acceptance.

No deployment, hosted migration, real customer change, payment or external customer message. Source changes flow through the existing isolated target materialization/parity checks; deployed parity remains unverified. Owner-observed backup restoration and 23-to-25 rehearsal are not repeated or invalidated by this UI-only change. Private backup-retention evidence, authenticated Cloudflare provenance, separate exact migration/publication approvals and physical iPhone acceptance remain outstanding. Production release acceptance stays 3/10 gates (30%).

Next bounded work: test remaining real Dashboard/bell-to-customer closeout navigation and completion/payment UI together in the built local Worker, then prepare the exact approved QA candidate. No hosted execution is authorized.
