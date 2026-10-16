# FIRE Gate 5 — owner Windows metadata capture (October 15, 2026)

**State:** Prepared and locally tested; remote ten-query batch has NOT run. Official readiness 30% (3/10); Gate 5 OPEN.

## Development deliverables

1. capture_doomsday_schema_read_only.py is dry-run by default. With --capture and typed exact full UUID, it authenticates the account D1 list, verifies the expected fire-app-staging-db UUID, and executes exactly ten vetted SELECT statements. It checks D1 inventory again after the capture.
2. Pins RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql to reviewed Git blob c931e45dd4d1a177011c73458da7be2dd050e673. Stops if the source changed.
3. Rejects unexpected/malformed CLI JSON, schema row keys, missing schema, invalid financial count fields, mismatched 22-entry migration journal, wrong D1 and oversized result sets. Refuses to write a successful partial capture. Does not echo stdout/stderr containing possible account data.
4. On complete results, creates one owner-private metadata-only JSON receipt in FIRE-Private-Backups with the strict verifier structure. It leaves sourceCommit, activeVersion and providerRecordId EMPTY because deployed artifact/provider attestation cannot be inferred from D1 CLI inventory or a temporary config.
5. test_capture_doomsday_schema_read_only.py: six synthetic tests passed locally, exercising fail-closed paths, source integrity, metadata output and no inadvertent disclosure. No tests have yet run on the owner Windows machine.

This is not a deployment or migration tool, and does not perform any Stripe or database writes. The SQL file itself returns schema/index/journal definitions and aggregate anomaly counts only.

## October 15 owner observations

The owner supplied eight screenshots of the hosted payment schema query against D1 UUID afb2c05a-d794-4a9a-b580-924ce01c26ad. They show payments/payment_refunds tables and existing indexes, including payment refunds and an existing narrow refund-provider uniqueness index. This source remains pre-0022; earlier separately reviewed 0022 named journal/index counts were 0/0. Earlier ledger checks returned zero anomaly groups. Screenshots show only portions of the huge output, so do not mark ten-query completeness.

The owner also completed independent private SQL export; local disposable SQLite restore/integrity tests; offline 0022 and savepoint rollback rehearsal; private AES-256 7z archive whose test required password; Google Drive upload with Restricted owner-only access; download and byte-identical SHA-256 checksum comparison; and password recovery retained independently of the laptop. No raw SQL was uploaded to Git or ChatGPT. Cloud SQL export cannot establish writer quiescence or active runtime identity, and does not include photo storage.

## Owner follow-up

From regular PowerShell in the existing repository checkout, first update and run the default dry run:

    git -C "$HOME\first-in-response-website" pull --ff-only
    py -3 "$HOME\first-in-response-website\business-app-parity\capture_doomsday_schema_read_only.py"

No Cloudflare calls on dry run. On separate explicit owner choice, a single remote ten-SELECT batch can be started:

    py -3 "$HOME\first-in-response-website\business-app-parity\capture_doomsday_schema_read_only.py" --capture

The helper requires typing CAPTURE followed by the full exact database UUID. It then saves a metadata-only result; never send raw SQL, secrets or session tokens.

## Remaining Gate 5 requirements

- Establish authenticated active Worker deployment version, artifact provenance and exact DB binding; independently exclude LIVE/refund-staging collisions.
- Review all ten captured metadata/count-only queries against the historical schema and additive 0022; independently verify active source identity and a current zero-anomaly preflight.
- Obtain a reviewed target-specific migration checksum, writer-quiescence (including webhook writers), recovery/rollback that accounts for post-backup writes, maintenance plan, and specific separate owner authorization before any hosted migration.

No remote schema write, hosted migration, deployment, Stripe request, changes to customer records, or release-gate acceptance was performed.


## Owner screenshot — completed Windows capture on October 15 (new)

The owner subsequently performed the updated pinned review with an exact Doomsday
D1 UUID confirmation on the Acer. The final PowerShell screenshot explicitly
shows **9/9 test cases passing** (Ran 9 tests ... OK) and **all ten remote
read-only SELECT metadata queries completing** with the program's final
"remote database not modified" completion message. The program saved
FIRE-DOOMSDAY-METADATA-ONLY-*.json locally under FIRE-Private-Backups.
The printed row counts clearly begin **52, 163, 23, 63, 22**, consistent
with ten-result completeness and the 22-migration pre-0022 journal, but
the remaining counts are clipped by the image boundary. Their values
must not be guessed from the screenshot; the owner-held receipt contains them.

This updates the prior statement that "remote ten-query batch has NOT run":
**it has now run successfully**, on the owner's computer. The earlier captured
offline local SQL recovery and encrypted Google Drive archive remain independent.
The private receipt was **not** uploaded to ChatGPT or GitHub. The screenshot
alone does NOT establish byte-exact comparison against pre-0022 migration
definitions, currently active deployed source/artifact identity, LIVE and
refund-staging D1 isolation, a writer-quiescent maintenance window, current
candidate parity, or Gate 5 acceptance.

### Immediate next evidence action, offline only

New compare_doomsday_pre0022_capture.py compares this one private ten-query
metadata receipt against historical Doomsday migrations 0000-0021, not
the later 23-migration candidate. It prints mismatch query *numbers*, zero/nonzero
aggregate counts, and a not-accepted release status **without displaying
or uploading raw metadata**. New test_compare_doomsday_pre0022_capture.py
contains synthetic coverage; it still requires Windows owner execution.
This follow-up requires **no more hosted SQL queries**.

From owner's regular Windows PowerShell, after a fast-forward repository pull:

    py -3 "$HOME\first-in-response-website\business-app-parity\test_compare_doomsday_pre0022_capture.py"
    py -3 "$HOME\first-in-response-website\business-app-parity\compare_doomsday_pre0022_capture.py"

The second program chooses the newest matching metadata-only receipt in the
private backup folder (unless an explicit path is supplied), validates the
exact target and 10-query shapes, and reports only summarized findings.
Do not upload the receipt, local SQL export, encrypted archive, or password.
A failure/mismatch must be reviewed, never masked.

**Official readiness remains 30% (3/10), Gate 5 OPEN** until provider binding,
deployed Worker artifact provenance, isolation, and separately reviewed migration
authorization/safe rollback acceptance. This checkpoint performs no hosted
mutations or deployments.


## Owner next screenshot — offline 22-migration baseline comparison

Owner's Windows screen shows **6/6 local synthetic comparator tests passing**,
and receipt FIRE-DOOMSDAY-METADATA-ONLY-20261016-033529.json identified.
The private 10-query receipt was checked against historical Doomsday 0000–0021.
Results: **only Query 1 differs** (sqlite_master table/index CREATE definitions).
Queries 2–10 exactly matched local baseline. All five aggregate foreign-key,
provider-collision, refund-link/ledger, and overreserved-refund counts equal
zero. The result is **REVIEW_REQUIRED**, not a pass.

Cause of Query 1 drift is **not established**: could be additional/missing
table/index definitions, CREATE SQL text differences, or a row-order issue.
Do not declare a formatting-only issue until identifiers and exact definitions
are reviewed. No remote queries, database writes, or migrations were run during
this comparison. Existing archive and receipt must remain private.

To investigate without posting raw SQL or re-running hosted queries, new
schema_object_differences in compare_doomsday_pre0022_capture.py prints
Query 1 expected/captured object counts, missing/unexpected object identifiers,
changed known object identifiers and the status of SQL-token formatting
comparisons, with CREATE SQL and record contents withheld. This does not
relax exact schema acceptance. New synthetic tests cover drift, no SQL output,
order-only mismatch and duplicate object rejection; owner Windows has NOT
yet run the updated ten-test suite. Explicit sqlite3 closing also eliminates
the fixture's prior unclosed-connection ResourceWarning.

Recommended owner-only next call (after fast-forward pull), no Cloudflare:

    py -3 "$HOME\first-in-response-website\business-app-parity\test_compare_doomsday_pre0022_capture.py"
    py -3 "$HOME\first-in-response-website\business-app-parity\compare_doomsday_pre0022_capture.py"

Stop on test failure. Only sanitized final console output should be supplied.
No migration/Stripe/deploy or active binding change is authorized. Gate 5
remains OPEN, official release readiness 30% (3/10).


## D1 reserved-table diagnosis from owner screenshot (October 15, 10:43 PM CDT)

Owner's updated Acer output confirmed **10/10 offline synthetic tests pass**,
receipt matching queries 2–10, and all five aggregate anomaly counts zero.
The sole Query 1 difference was 52 observed schema objects vs 51 from
historical migrations 0000–0021. No missing application objects and no
modified CREATE definitions. Exactly one extra "table / _cf_KV / _cf_KV".

**Independent Cloudflare documentation verifies _cf_KV is a reserved internal
D1 storage table**, not an application table:
https://developers.cloudflare.com/d1/best-practices/import-export-data/
Do not drop, alter, query its data or include it in an application migration.
This does not justify ignoring other or generic _cf-prefixed objects.

The offline comparator now allows one narrowly checked _cf_KV exception:
exact reserved object type/name/owner, documented two-column schema,
and unmodified baseline objects with exact row ordering. It continues to
retain/report the raw Query 1 difference; distinguishes application-only
comparison MATCH_D1_RESERVED_TABLE from a byte-for-byte full-system
match; refuses malformed/multiple unexpected objects and nonzero financial
anomaly counts. These changes do not set gate5Accepted true or change the
official readiness 30%. Five extra synthetic tests added (15 total),
still awaiting owner Windows execution after a fast-forward pull.

Owner should run (local only, no CAPTURE and no Cloudflare):
  git -C "$HOME\first-in-response-website" pull --ff-only
  py -3 "$HOME\first-in-response-website\business-app-parity\test_compare_doomsday_pre0022_capture.py"
  py -3 "$HOME\first-in-response-website\business-app-parity\compare_doomsday_pre0022_capture.py"

Remaining gate acceptance blockers (independent of this schema exception):
authenticated active Worker version/build/source and runtime DB-binding
attestation; proof LIVE/refund-staging physical isolation; reviewed
pre-0022 to candidate-0022 plan with writer quiescence, webhook protection,
safe backup and recovery window, independent signoff and fresh anomalies.
No hosted migration/deploy or real records touched.

## Final owner Acer verification — historical Doomsday schema accepted locally

Owner screenshot received after installing the narrow Cloudflare-reserved `_cf_KV`
exception. It shows **15/15 synthetic local tests passing** and an offline
comparison against owner-held metadata receipt
`FIRE-DOOMSDAY-METADATA-ONLY-20261016-033529.json`:

- 51/51 application schema object definitions match historical pre-0022.
- Exactly one additional table is Cloudflare's reserved `_cf_KV`;
  strict narrow internal-table exception applied, with the raw Query 1
  difference retained in the report.
- All other nine read-only result sets match baseline.
- All five aggregate FK/payment/refund safety counts are zero.
- Result is `MATCH_D1_RESERVED_TABLE`; 22 migrations 0000–0021.
- Metadata verification ran **offline** against the owner's existing receipt;
  no new Cloudflare queries, mutations, Stripe requests, or deployments.
- Receipt and encrypted export remain owner-private; only sanitized console
  results were shared in the conversation.

**Completed technical subcheck:** historical Doomsday D1 application-schema
match and clean point-in-time financial anomaly counts. **Not completed:**
deployment/source provenance attested by the provider independently of
owner-provided logs; current active route/version seal; LIVE/refund-staging
physical DB isolation; approved writer-quiescent migration 0022 window and
hosted post-apply/rollback checks; full release acceptance.

Do not re-run Query 1 investigations, historical 22-migration schema captures,
or encryption/archive/hash checks merely to repeat this completed evidence.
A fresh *point-in-time* financial check will still be required immediately
before any separately approved hosted migration, once writers are paused.

**Gate 5 remains OPEN. Official overall readiness stays 30% (3/10).**
