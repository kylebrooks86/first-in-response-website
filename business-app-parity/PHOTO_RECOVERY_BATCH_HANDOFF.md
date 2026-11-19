# Photo recovery safety batch — 2026-10-08 Chicago

Parent checkpoint671f52a2d31d5dfd43942882328c5329dab40a52; fresh GitHub fetch matched local HEAD and no unsaved canonical changes existed. Scope: candidate recovery CLI only. Existing LIVE/DR production and databases/buckets are unchanged.

## Implemented identically across candidates

- Remote apply requires exact database ID as well as bucket confirmation. No restore was executed remotely.
- Reject duplicate ZIP entries, unsafe entry names, duplicate photo IDs and duplicate object keys; reject incomplete database-inspection results rather than treating them as an empty target.
- Permit missing-file recovery when existing photo metadata matches customer, object key and size. INSERT OR IGNORE preserves existing caption, filename and metadata; conflicting ownership/key/size is skipped.
- After an INSERT error or failed/mismatched verification, preserve uploaded photo bytes. An error can occur AFTER metadata commits; automatically deleting the object could leave a valid record without its photo. Fail explicitly and require target inspection before retry. No automatic R2 deletion remains in this helper.
- Correct CLI usage text to the actual node command.

## Tests

19 cases per target,3/3 suites,57/57 case executions passed using actual CLI subprocesses, synthetic ZIPs, disposable real SQLite databases and a local-only fake Wrangler. No fake command can reach Cloudflare. Tested dry-run/no writes, successful restore, missing customer, conflicting metadata, matching metadata with lost file, existing-object skip, missing archive objects, duplicate IDs/keys/entries, unsafe entry paths, incomplete query results, incorrect byte size, committed INSERT followed by a lost response, verification error/mismatch, absent bucket, missing remote database confirmation and remote-mode dry run. Every case asserts zero object-delete commands and unchanged payment fixtures. Matching/conflicting existing photo rows are compared in full to prove preservation. Recovery files byte-identical across all three targets; syntax checks3/3 passed.

No runtime source/dependencies/schema changed, so prior TypeScript/build/Stripe regressions were preserved rather than unnecessarily rerun. These tests do not establish working Cloudflare R2 recovery, image validity, remote migration safety, mobile appearance or Stripe end-to-end integration.

## Remaining limitations

Independent deployment still has no verified bucket. No storage service was activated or purchased, and LIVE storage was not connected to DR. Real storage errors/permissions and hosted restore must be tested after independent free resource availability and exact targets are confirmed. Separate process concurrency (object created between check and upload) is not solved by these tests; no concurrent remote recovery is approved. An ambiguous restore may intentionally leave an uploaded object requiring manual inspection; no success is claimed when verification fails.

Carry forward remote schema0/3, formal mobile parity0/32, production readiness3/10 NOT READY, sandbox destination still pointing to LIVE without refund events, and deployed DR commit identity unresolved. No Cloudflare sign-in retry was repeated during this batch. No production, migration, auth, Stripe configuration, charge or refund changed.

## Next bounded batch

Verify target schema/provenance with authenticated read-only Cloudflare access or the prepared SQL outputs when available. Otherwise examine one isolated mobile or restore-validation gap. Hosted sandbox tests require verified isolated routing first; never replay events to LIVE. Stop after saving this checkpoint. QC chat reviews this CLI diff and tests read-only.
