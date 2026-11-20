# Job costs loader recovery — 2026-10-09

Parent bd7b02771cfd106b4315d552a2106df43ee2f5ec. Fresh remote fetch matched clean local checkout before editing. FIRE Business App only; previous completed work preserved.

Confirmed JobCost duplicated unchecked asynchronous expense reads could show zero costs/full profit after failure, overwrite a changed/reopened job with an older read, or expose stale values. Only JobCost runtime code changed. Unified effect/retry/post-save refresh through a guarded read: request generation and active job identity prevent stale responses and old-job refresh callbacks from replacing the current job. Close/unmount invalidates reads. HTTP/network/JSON/collection/record failures, invalid amount types, fractional/negative/nonfinite/unsafe cents and unsafe aggregate sums show an alert and Retry loading costs. Last-good rows remain internal; totals, empty-state claims and entry controls stay hidden while costs are unknown or failed. A successfully loaded job ID guards rendering before a changed-estimate effect runs. Successful reads filter by job; only successful empty data shows zero costs.

The expense POST add handler is byte-identical. No API, financial helper, CSS, adapter, migration or other component changes. The handler's existing write/error behavior is outside this read-only recovery batch.

## Exact local verification

- New actual-component load/hook/JSX synthetic GET checks: 460/460 per candidate, 1,380/1,380 across isolated LIVE/independent Doomsday/staging candidates. Covers close/reopen and estimate switches, delayed JSON, stale success/failure, unmount, old refresh callbacks, failed HTTP/network/malformed expense records and amounts, unsafe aggregate totals, job filtering, retry and empty results.
- Parent negative control fails unknown cost/profit hiding assertion.
- Selected suites: 9/9 (job-cost recovery, prior job-report recovery, processing-fee financial regression on each target). Prior report checks 338/338 per target remain passing. TypeScript 3/3; framework builds 3/3. Shared app source parity 119/119 and new script byte-identical across candidates.
- Final review manifest verified; snapshots and log hashes saved in JOB_COST_RECOVERY_EVIDENCE.json. Prior snapshots, historical manifests, partial owner Cloudflare findings and non-executing 0022 plan preserved.

During test development the totals collector initially included a cost-description strong tag and did not wait for the void retry callback; the harness was corrected to select summary values and flush the synthetic async read. First TypeScript run caught a narrow API type preventing a numeric-string guard; the untrusted value now validates as unknown. All final checks above ran against the corrected source/test.

Tests use extracted actual component functions with simulated hooks and local synthetic financial fixtures. No actual browser/React lifecycle, iPhone, hosted integration or Stripe evidence was collected. No deployments, remote database writes/migrations, Stripe calls or paid services occurred.

Official overall verified readiness remains 3/10 release gates (30%), NOT READY. Formal deployed/mobile comparison 0/32; complete remote schema/journal verification 0/3. Owner Doomsday partial findings remain recorded; migration 0022 remains unapplied there. Most useful next release step: read-only capture of full Doomsday deployed version/build source and immutable D1 binding identity, then reconcile historical a1cdb94 versus current candidate. Next bounded local batch if access remains unavailable: review one remaining read-only loader for confirmed recovery issues. Stop cleanly after the verified save; overnight runs remain stopped.
