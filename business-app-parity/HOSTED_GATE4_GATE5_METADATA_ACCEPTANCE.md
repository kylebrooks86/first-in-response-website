# FIRE hosted identity and schema acceptance — read-only handoff

**Scope:** existing LIVE, existing refund staging, and independent Doomsday.
**State:** NOT ACCEPTED. Official readiness stays **30% / 3 of 10 gates**.

This document prepares evidence comparison; it **never authorizes** deployment,
database changes, migrations, Stripe charges, remote restores, or cutovers.

## Already verified and still missing

The three coordinated candidates passed isolated source checks, TypeScript,
target-specific local migration rehearsals, financial checks and builds.
That does **not** establish that those candidates are deployed.

Saved LIVE and refund-staging Sites project IDs are distinct, but this does
not establish physical D1 isolation. The historical Doomsday DB binding UUID is
afb2c05a-d794-4a9a-b580-924ce01c26ad, but requires refreshed
provider-authenticated confirmation. Previously LIVE showed only 18/19 table
names and was missing payment_refunds; staging showed 19/19. Neither result
establishes full SQL/index/journal equivalence. Candidate migrations number
21 for LIVE and refund staging and 23 for Doomsday.

## Required provider/owner read-only evidence

For **each** of LIVE, staging, and Doomsday, collect:

1. Actual immutable D1 database UUID bound as DB to the currently active
   deployment, together with provider-attested resource mapping and selected
   target. Do not substitute Sites project IDs or names for D1 UUIDs.
2. Active Worker/deployment version, route URL, full deployed source SHA,
   provider record reference and timestamp in UTC. A saved GitHub commit alone
   cannot seal the deployed runtime artifact.
3. All ten SELECT-only metadata/anomaly-count queries from
   RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql, run on that **exact** D1. They
   return schema/index/column/foreign-key definitions, ordered migration
   journal names, and integer counts only. SELECT 1 now includes **all**
   non-internal application tables and indexes to expose unexpected objects;
   the provider-owned d1_migrations CREATE statement is excluded because its
   syntax can vary, while SELECT 5 compares its ordered migration names.
4. Explicit error/truncation/missing-table status for any unavailable result.
   Never replace a failed query with empty rows or assumed zero counts.

**Never include customer rows, payment rows, bank details, secrets, API
tokens, PINs or Stripe credentials in a capture or repository.** Do not upload
complete live SQL backups here. Store any sensitive recovery exports in a
separate owner-controlled location.

## Expected JSON shape

Each numbered query must have its actual returned row objects in original
query order. This is a shape example, **not a valid evidence file**. Use
the exact URL for each target, and three entries in the captures array.
Use "staging" (not "refund-staging") as the target identifier.

~~~json
{
  "format": "fire-read-only-d1-schema-v1",
  "captures": [
    {
      "target": "live",
      "url": "https://fire-app.kylebrooks8605.chatgpt.site",
      "capturedAt": "2026-10-14T23:00:00Z",
      "providerMetadata": {
        "binding": "DB",
        "databaseUuid": "REPLACE_WITH_PHYSICAL_D1_UUID",
        "activeVersion": "REPLACE_WITH_ACTIVE_DEPLOYMENT_VERSION",
        "sourceCommit": "REPLACE_WITH_FULL_DEPLOYED_SOURCE_SHA",
        "providerRecordId": "REPLACE_WITH_PROVIDER_ATTESTATION_REFERENCE"
      },
      "truncated": false,
      "queries": [
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []},
        {"rows": []}
      ]
    }
  ]
}
~~~

**All placeholder values and empty query lists above must be replaced with
real, complete metadata-only read results.** Never mark truncated=false
without actual capture completeness. The verifier rejects any unexpected
JSON fields as a safeguard against accidental customer/financial data.

## Compare locally; never run hosted SQL from the verifier

From the repository checkout, with the raw capture file stored outside Git:

~~~bash
python3 business-app-parity/verify_hosted_schema_capture.py /path/to/metadata-only-capture.json
~~~

The verifier constructs expected schema/index/journal results only from
the current local target migration files and compares all ten numbered
queries, the D1 identity fields, target URL, time, and completeness. It
detects unexpected tables/indexes, wrong index predicates, missing columns,
altered foreign keys/journals, nonzero payment anomalies, and identical
claimed D1 UUIDs for different targets. It performs no remote operations.

- Exit 0: technical result sets match all three candidate schemas; this
  does NOT authenticate provider claims or pass any release gate.
- Exit 1: incomplete or mismatched capture. Investigate; no auto-repair.
- Exit 2: malformed or unavailable input.

Even when all local metadata comparisons match, the report always records
gate4Passed=false, gate5Passed=false, productionReady=false and
publicationAuthorized=false. Current deployed source/artifact linkage,
provider-attested physical DB isolation, and acceptance must be
independently reviewed. A self-supplied JSON file can be forged.

## Release stop conditions

**NO-GO** if any physical DB mapping is absent/duplicated, LIVE is missing
payment_refunds, Doomsday journal 0022 is absent for the new candidate, any
constraint or partial-index predicate differs, a journal is inconsistent,
any financial anomaly count is nonzero, or active artifact identity is
unavailable. Never modify historical customer ledger data to force a pass.

Only after a separately authenticated hosted review should an exact
owner-approval packet name a deployment source, target D1 UUID, required
migration checksums, backup hash, maintenance window and tested rollback.
Local synthetic rollback evidence does not complete Gate 10.

Related: GATE4_PROVIDER_EVIDENCE_REQUEST.md,
DOOMSDAY_0022_MIGRATION_PLAN.md, and
RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql.

## Cloudflare-reserved D1 table and CI safety checkpoint — October 15/16

Historical owner-held Doomsday capture is now verified locally:
15/15 pre-0022 historical regression cases passed, **51/51 application
schema definitions matched**, all nine remaining query result sets
matched the 22-migration baseline, and all five aggregate anomaly counts
were zero. Query 1 had one extra provider-owned `_cf_KV` table;
Cloudflare documents it as internal storage. That exception does not
authorize migration 0022 or certify the deployment's current identity.

The *candidate* hosted-schema verifier now applies the same narrow,
strictly checked exception for LIVE, staging, or Doomsday in Query 1 only.
It accepts exactly one `table/_cf_KV/_cf_KV` with Cloudflare's documented
key/value WITHOUT ROWID CREATE definition and **requires all actual
application objects, definitions, and row ordering to equal the expected
candidate**. It still rejects any different provider-looking table,
missing refund table, altered partial index SQL, duplicate object,
extra index, missing journal entry, nonzero financial count, missing
provider identity, wrong UUID or cross-target UUID collision. The
report records `documentedD1ReservedTableOnly` per target.

CI is wired to execute owner-safe ten-query-capture and historical
pre-0022 comparator security tests on relevant changes in addition to
hosted candidate verifier negative controls. The six-job isolated suite
for code commit `6bfcd200b40c4e3a0d604d03aacfc2614640caed` passed:
https://github.com/kylebrooks86/first-in-response-website/actions/runs/38849040690

CI uses synthetic test data and never reads the owner's private capture
or backup, changes hosted resources, deploys an app, applies 0022 or
sends Stripe requests. The previous full LIVE table-name discrepancy
(payment_refunds absent in observed deployed legacy LIVE) remains a
separate blocker; do not silently treat it as resolved by the reserved
table exemption. Release readiness remains **30%, three of ten gates**.

Next externally dependent requirement: provider-attested immutable
resource mapping and current routed Worker version/artifact association
for LIVE, staging, and Doomsday, then full three-target candidate
schema/journal verification and independently approved writer-safe
migration and release plan. No user needs to repeat the completed
historical Doomsday schema comparison.
