# Release blocker checkpoint — 2026-10-09

Parent fd0acba588e7d6f9cff4fdac64461c0355c580a1. Clean local checkout and freshly fetched remote matched. This batch prioritizes release evidence and safe preflight, not another UI loader. No hosted environment was changed.

## What currently runs versus the candidate

| Target | Observed source/build evidence | Candidate schema gap | What is still missing |
| --- | --- | --- | --- |
| LIVE | Fresh native saved version 61, source 896b5e4125cb89da729993d1f37127e3b930c79d, successful publish attempt, environment revision 9 | Fresh complete table-name projection has 18/19 candidate tables; payment_refunds is missing | Runtime routing seal; immutable D1 UUID; full SQL definitions/indexes/journal; approved schema upgrade before latest candidate promotion |
| Refund staging | Fresh native saved version 3, source f7ed28a5d13ada738f5663e4f55a45c5d794c21e, successful publish attempt, environment revision 2 | Table-name projection matches 19/19; this alone does not verify indexes or migrations | Runtime routing seal, immutable resource isolation, complete schema/journal and safe sandbox configuration |
| Doomsday | Owner supplied Worker fire-app-independent-staging, active version prefix 61fa32a3 at 100%, GitHub link a1cdb94be76b0ded16b213b84616e741651e140d | Owner verified journal 0000–0021; 0022/index absent | Full active version UUID/build source/root/artifact identity; signed-in runtime capture; actual immutable D1 UUID; complete SQL schema/index definitions |

Native saved-source/publish metadata does not establish deployed runtime equivalence. The development candidate remains unpublished. Missing LIVE payment_refunds is a promotion blocker; it does not prove legacy LIVE is broken. Historical owner Doomsday findings remain preserved with their provenance. The a1cdb94 reference uses the Business App fire-app-dr build and overlays despite the branch name; it is not the coordinated current candidate. Do not run the historical deployment/preparation wrappers.

## Concrete blocker fixed

The existing local candidate preflight runner still mapped only three SELECT checks after the SQL preflight had gained its fourth cumulative refund reservation check. Running the actual previous candidate test reproduced a crash: Unexpected read-only ledger preflight query set. The runner now maps the fourth result as overReservedRefundPayments and blocks an otherwise individually valid refund set whose pending+succeeded aggregate exceeds the original payment.

New regressions cover individually valid aggregate overflow, succeeded-reservation contribution with matching ledger, failed/canceled reservation release, exact boundary, and read-only CLI failure with unchanged database bytes. The prior runner crash is retained as a negative control. No application runtime, API, financial calculations, CSS, dependency, authentication adapter or migration changes occurred.

Exact results: 51/51 candidate preflight checks per target, 153/153 total; 18 new checks per target, 54/54 total. Selected suite runs 9/9 across three candidates: candidate DB preflight, local schema audit and provider uniqueness migration regression. All migrations ran only against disposable local SQLite. The migration regression retains 9/9 reservation/ownership/ledger checks per target. Shared app source parity remains 119/119; both changed scripts match all three new isolated snapshots. Application TypeScript/builds were not repeated: app source is byte-identical to fd0acba and its 3/3 TypeScript/build results remain preserved, not counted as new executions.

The release preflight snapshots are in CANDIDATE_COMMITS.json under releasePreflightCandidateCommits. Latest verified app candidate/evidence pointers are deliberately preserved for the previous runtime batch; fresh review manifest hashes this release tooling and the updated release evidence separately.

## Minimal owner capture to unblock the next batch

First, while already signed into Doomsday, open:
https://fire-app-independent-staging.kyle-bfc.workers.dev/api/dr-capture-identity

Paste the JSON response. It should contain only non-secret sourceCommit, captureId, release/package and registry fingerprint fields. This session made one unauthenticated read-only attempt and received HTTP 403; it did not capture identity, and the status does not prove the endpoint is absent. No login/session/PIN changes or bypass were attempted.

Then capture the same deployment's full active Cloudflare version ID, configured build root/command/source commit, and DB binding's actual D1 database UUID. The historical script's afb2c05a-d794-4a9a-b580-924ce01c26ad is an expectation, not a substitute for current binding evidence. Never share a session secret, PIN, API key or Stripe secret.

RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql contains ten independent SELECT statements for full table/index SQL, column definitions, foreign keys, index columns/flags, ordered migration names, FK violation count, and four ledger anomaly counts. Outputs contain schema/journal metadata and counts, not customer/payment rows. Capture them separately per owner-selected target with URL, actual UUID and timestamp. LIVE's missing refund table makes refund queries unavailable; record that instead of creating a table. This file is not migration/deployment authorization. Local tests execute all ten queries on each target fixture without schema, journal or record changes: 30/30. This proves local SQL compatibility only, not Cloudflare execution or remote schema verification.

## Exact next release decision

After receiving identity/schema captures, compare them to the frozen candidate and distinguish required migrations per target. Keep 0022 review/backup/quiescence/rollback restrictions unchanged. Prepare an approval packet naming one exact synthetic comparison destination, its isolated immutable bindings, exact source/snapshot, required migration checksums, backup proof and rollback. Ask for deployment/migration approval only when that packet is concrete and necessary preflight checks pass. No deployment is currently proposed as safe or authorized.

Collect same-device light/dark screenshots and workflow results after an authorized candidate comparison setup. Current LIVE and Doomsday screenshots can document existing differences but cannot prove the unpublished candidate fixes. Existing production records must remain independent. No real Stripe transaction is needed to begin visual comparison; separate sandbox integration remains a release gate.

Official readiness remains 3/10 (30%), NOT READY: passed shared source, isolated regression and target compilation gates. Pending deployed identities, complete remote schema/journals, auth adapter, photo storage, mobile evidence, sandbox integration and rollback/seal. Formal deployed/mobile comparisons 0/32; complete remote schema gates 0/3. No deployment, migration, remote database write, Stripe call or paid service occurred. Stop after saving; do not keep repeating small reliability batches while these access/capture blockers remain unresolved.
