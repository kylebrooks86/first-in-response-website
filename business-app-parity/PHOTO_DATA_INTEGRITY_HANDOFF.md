# Photo upload/delete data integrity — actual shared and independent source

Base: `6772df7d2ab96ae4bda25aa197a97612316a5d64`. Both uploaded patches passed applicability checks and original upload sources matched that commit byte-for-byte. Latest property workflow was preserved by fast-forwarding the stale local checkout before editing its UI.

## Implemented

Both shared and independent DR POST handlers retain uploaded image bytes when D1 insertion throws, because the insert may have committed before the acknowledgement was lost. They return 503 with `saveUncertain`. Both DELETE handlers require storage, confirm D1 metadata deletion before requesting R2 deletion, preserve bytes when the database result is ambiguous (`deleteUncertain`), and report failed storage cleanup after confirmed metadata removal (`cleanupUncertain`). Existing owner authentication and file validation remain unchanged. No global transaction spanning D1/R2 is claimed. Preserved orphaned objects are an intentional tradeoff and need independent reconciliation.

Both CustomerPhotos UI bodies match exactly. They display server/network errors, safely refresh this customer's photo records with read-only requests, stop a bulk upload at the first unconfirmed result, lock upload/delete actions, and require explicit owner review before enabling new deliberate actions. Refresh never replays POST or DELETE. Another in-flight action is blocked synchronously. Caption/input state is not treated as confirmation of storage outcome. Uncertain cleanup remains visible; refreshing metadata does not prove object cleanup. This pause is in-session, not durable/global upload idempotency.

## Verification

The retained handoff suites run against exact source snapshots, with current shared-source equality assertions: upload 38/38, delete 40/40, repeated across three materialized candidates (234 route assertions). Original negative controls reproduce the original lost-bytes failures. Snapshots are text fixtures, not application modules; the full TypeScript configuration was not weakened.

Actual native workerd/D1/R2 browser tests run the shared handlers with each target's real local auth adapter under synthetic owner fixtures. Native SQL rejection verifies uploaded-object preservation and byte-identical image retention on failed metadata deletion. HTTP-response-loss fixtures forward real POST/DELETE operations before substituting 503, verifying truthful UI refresh and absence of automatic retry. The storage-inspection endpoint exists only during each disposable candidate test, is owner-authenticated, and is removed before builds. No test route is in shared app source or a candidate release artifact.

See `PHOTO_DATA_INTEGRITY_EVIDENCE.json` for final checks and limitations. Hosted round-trip, physical storage UUID isolation, archive recovery and real device/owner acceptance remain unverified. These native local tests do not pass Gate 7.

## Preserved release work and next task

The property upgrade generator, generated review packages and read-only preflight draft were preserved separately at `/workspace/scratch/ea2056c53961/property-release-draft`; they are unverified and deliberately excluded from this verified photo commit. Finish their exact schema/journal, WAL/read-only and rollback tests next, consulting the independently prepared preflight handoff if available. A fresh supported Sites overview confirmed LIVE has 18 user tables and lacks payment_refunds; refund staging has 19 including payment_refunds. Overview does not expose full definitions/indexes/journals or immutable physical database identity. Do not infer Gate 4/5 acceptance or retry unsupported endpoints.

Property implementation remains 5/5 scoped milestones (100%). Official release readiness remains 3/10 gates (30%). No deployment, production schema/data write, Stripe/credential action, installed-app change, existing backup change or paid resource occurred. Independent source files were corrected as explicitly requested; historical sealed rollback archives remain unchanged.
