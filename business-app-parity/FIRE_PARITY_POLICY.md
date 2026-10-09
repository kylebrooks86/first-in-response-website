# FIRE Business App parity requirement

All active LIVE, Doomsday, staging, and disaster-recovery Business App versions must use identical shared business logic and presentation. Business Command Center, calculators, and marketing sites are outside this requirement.

Apply every approved feature and fix to isolated candidates for every active target. Maintain a complete target inventory. Run the shared-source parity gate and financial regression tests before release. Do not claim deployed parity from source parity alone: record authenticated browser evidence, mobile light/dark review, and deployed release identity for every target.

Never overwrite independent databases, customer/financial records, Stripe configuration, authentication, or migration history to achieve parity. Authentication, environment labels, hosting bindings, and target-specific migration histories are explicit deployment adapters; they must preserve existing security and reach an equivalent final schema. Preserve historical rollback copies unchanged. Do not purchase, subscribe to, or activate paid services.

Production publication requires the owner’s explicit approval of exact candidate commits, database migrations, test results, and rollback plan. Staging must use synthetic records and sandbox Stripe only. Do not process real test payments. A release is blocked while any deployed identity, schema compatibility, security adapter, storage capability, or mobile workflow remains unverified.

## Development batches — permanent workflow

Target approximately 10–15 minutes per self-contained batch, focusing on one meaningful task. This is a planning target, not a reason to pad small work or abandon a safe checkpoint. Choose one bounded outcome and reserve time for verification, saving, and handoff. At the start, check the remote development branch and local changes; resume the latest verified checkpoint without repeating completed audits or unchanged passing tests unnecessarily.

Prioritize functional parity, Stripe sandbox integration, database safety, and mobile visual matching across isolated LIVE, Doomsday and staging candidates. Work chat alone modifies shared branches/staging candidates; the separate regular chat performs independent read-only quality control.

During active work, provide brief progress updates approximately every 3–5 minutes whenever tools allow. State the verified finding, current task and next check; do not treat a progress update as the end of the batch. Avoid long blocking operations that prevent communication.

At every batch end:

1. Run relevant tests for the changed behavior, inspect results, and distinguish local/mock results from deployed integration or iPhone evidence. Documentation-only changes require content/diff checks, not unrelated application test reruns.
2. Save safe completed changes to work/fire-business-app-parity-2026-10-08, checking the current remote head before updating it. Never overwrite newer remote work.
3. Preserve unfinished work separately and document its exact location, blockers, and pending checks; never represent unverified work as release-ready.
4. Report concise status bars with numerators, denominators, accurate percentages, and clearly defined scopes. Keep source parity, tests, deployed functionality, mobile parity, and production readiness separate. Every user-facing progress and final update must include overall verified readiness as passed production release gates divided by total gates (currently 3/10, 30%). This is evidence-based release readiness, not a percentage of effort or time remaining; do not invent an overall estimate or increase it for candidate-only work.
5. State the next bounded batch and any necessary owner intervention. Stop cleanly after the handoff; do not automatically begin another long operation or imply background work continues.

If an interactive approval expires, preserve the checkpoint and report the exact blocked action. Do not wait repeatedly or infer authorization. Existing LIVE and Doomsday deployments, independent databases, Stripe settings/secrets, records and rollback copies remain untouched. No paid resources, production deployment, or database migration without explicit owner authorization.
