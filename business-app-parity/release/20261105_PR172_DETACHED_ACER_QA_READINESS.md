# PR172 — existing detached Acer worktree QA readiness

Production: **3/10 accepted (30%); Gates 4–10 OPEN; NO-GO.** No publication authorized.

## Preserved acceptance and exact scope

Application baseline: `16bea6d0acfa2ee30e7c41f4edd584a784bfa582`.
Pinned full regression: https://github.com/kylebrooks86/first-in-response-website/actions/runs/42058862763 — eight successful jobs, no skipped steps, same checkout SHA verified in each job. Built synthetic QA HTTP/SQLite/Chrome includes 370 checks. Six app-specific workflows passed; independent website verifier remains red. Protected website/calculator objects match main. No claims of hosted/iPhone acceptance follow from this CI.

This follow-on changes only QA release tooling, its regression coverage and this packet. Product/shared source, target adapters, SQL, website and calculator remain identical to that baseline. A new whole-repository SHA is not automatically 8/8: inspect the repinned harness and affected tooling jobs for the actual final commit.

Owner reports authenticated Acer QA Worker/D1/schema review PASS. Retain that accepted result; refresh identity immediately before a later approved publication rather than repeating unrelated device tests.

## Confirmed tooling defect and correction

Existing worktree: `C:\Users\Kyleb\FIREQA-PR172`, detached at earlier reviewed `495f24b87de3256b9b14f5815cb0c892c829bc50`.
The prior scripts required an attached branch; PowerShell could also call `.Trim()` on null when detached Git emits no branch name. Do not clone another repo, forcibly check out a branch held by another worktree, fake a tracking ref, reset or clean owner files.

Builder/reviewer now accept **explicit** `-AllowDetachedWorktree` only when HEAD is detached and ExpectedCommit is a full lowercase SHA. HEAD must still equal both ExpectedCommit and the fetched selected origin branch. Tracked edits are rejected before build/provider actions. Default attached-branch behavior is retained. Publisher forwards this option to both independent reviews but retains all existing Publish, photo, exact typed approval, schema, physical DB and active-version race guards. This capability is not publishing consent.

Native PowerShell regression executes the actual extracted Git guard blocks against disposable local Git repositories: attached/default and detached/explicit pass; detached/default, attached/explicit, missing pin, wrong pin, changed tracking ref and tracked edit fail. Both scripts tested: 16 cases; no provider commands. Linux CI and the existing Windows recovery job execute it.

## QA decision packet

| Field | Required value / evidence |
|---|---|
| Target | Existing synthetic-only `fire-fullapp-qa-20261016` |
| Current serving version and retained code rollback | `69373734-52b3-4747-8e1c-323a59e9710f`, sole 100% version; freshly recheck before publication |
| Physical DB | `8ccfb1f8-1657-4074-b1b2-47de78f95003` bound as DB |
| Storage/config | Existing DB and secrets retained, no R2, no Stripe |
| Schema | All 25 exact ordered migrations, required refund/deposit objects and immutable agreement triggers; metadata-only reviewer must pass |
| Source assembly fingerprint | `3610f8dea607d2de302759421d42fcd7510db3699e46b43f8a5ea175497abbb1` — 683 source files, 48 adapter files, 25 migrations |
| Existing CI build fingerprint | `45ae6a540dfddaf491e6daf793f24d6f5455f26ff6079dcc4942c39927a8e653` from baseline sealed review; not a claim about an unbuilt Acer artifact |
| Acer artifact | Still requires local build and `verify_materialized_candidate.py qa <candidate> --built` against final reviewed source; do not substitute CI archive identity |
| Photo custody | Owner's prior no-QA-photos attestation preserved; reconfirm only if photos have since been added |
| Authorization | Separate approval naming final source, this exact Worker/DB, retained rollback version and code/assets-only scope; no migration, secret/R2/Stripe/LIVE change |

A code rollback does not undo D1 writes or recover device photos. A verified backup and recovery evidence must remain independently owned and separate from code rollback. Do not remove an existing candidate directory if builder refuses overwrite; inspect its verifier result first.

## Owner sequence (substitute the final reviewed SHA, never a floating branch)

1. In the existing worktree, inspect `git status --porcelain` (including untracked files), `git worktree list` and HEAD. Stop on local changes. Fetch the existing PR172 branch. Require fetched origin HEAD == final reviewed SHA and old HEAD is its ancestor. `git switch --detach <SHA>` without force updates this same worktree, preserving the original branch/worktree.
2. Run `owner_windows_build_qa_candidate.ps1 -Build -AllowDetachedWorktree -CandidateBranch work/fire-gate8-gate9-unified-candidate-2026-11-05 -ExpectedCommit <SHA>` with process-scoped PowerShell execution policy only. No global policy changes.
3. Run `verify_materialized_candidate.py qa "$env:LOCALAPPDATA\FIRE-QA-Builds\qa-<SHA>" --built`. Preserve its sourceFingerprint and any existing build rather than overwrite it.
4. Run `owner_windows_qa_update_review.ps1 -AllowDetachedWorktree` with the same branch/SHA. This uses provider reads, metadata-only QA SELECT and local upload dry run. No Publish switch and no migrations.
5. Review outputs and ask for the separate exact-source QA publication decision. This packet deliberately contains no publishing command.

## Focused physical iPhone acceptance after separately approved QA update

- Open Customer View for an eligible saved estimate; scroll to the bottom; Close returns to the exact record. Repeat from invoice/customer invoice history. Check narrow portrait Safari and installed PWA.
- Toggle light/dark once controls enable; Close remains reachable and responsive without accidental repeat actions.
- Reopen a historical declined estimate: deposit history stays historical and no current scheduling/deposit action is incorrectly offered.
- Confirm changed controls remain usable with keyboard/scrolling; reopen the synthetic record after refresh. Preserve previously accepted Google Voice, customer-save, $25 quote and backup tests unless a regression appears.

## Gates 4–7: exact remaining evidence

LIVE Sites `appgprj_6aaf416f82c88191a292fa2e13a9ea61`; isolated refund staging `appgprj_6ac7e8e358dc81918d0a47c4034c4a41`. Owner and prior provider-overview evidence: LIVE lacks displayed payment_refunds; staging has it and owner opened an empty table. Do not reinterpret table names as physical storage UUIDs or complete schema.

Sites controls presently expose saved versions/access and bounded table names, not a complete current-route artifact mapping, physical DB mapping, ordered actual migration journal, index/trigger DDL or independent backup/restore contract. Never manufacture these fields, add a diagnostic endpoint or read individual customer/payment rows. Gate 5 metadata inspection follows authenticated target mapping. Investigate LIVE/staging 0019_unknown_jubilee.sql and 0020_stripe_provider_uniqueness.sql using the existing metadata-only evidence procedures; no blind replay, deduplication or schema writes.

Prepared support follow-up (not sent):
“Please append to the existing FIRE Sites specialist case: for the two exact project IDs above, we still need provider-attested currently routed deployment/artifact-to-source identity, unique physical DB mapping and isolation, ordered applied migration metadata plus refund indexes/triggers, and a supported independently recoverable private DB/file backup method. LIVE's viewer lacks payment_refunds; staging's table is present and empty. Please provide metadata only; do not publish, migrate, restore, alter configuration or disclose records. If UUIDs cannot be disclosed, specify an immutable provider-backed equivalent mapping for owner review.”

Gate 6 planned synthetic-only hosted matrix: owner positive; signed-out/nonowner denied; estimate token A cannot authorize invoice/customer B; forged owner-preview query/header denied; logout/restart clears private owner state; no owner IDs/tokens in shared/printed output. Source tests already cover equivalent synthetic negatives; hosted evidence remains open. Gate 7 needs actual bound DB/photo backup custody, hash/manifest, isolated restore proof and rollback limitations, preserving accepted QA backup/photo results.

## Gate 9 and release seal

Retain strict remote asset/binding comparison. Full Vite assets cannot be silently removed to suppress drift; an existing webhook-only no-assets bundle is source evidence, not authority to replace UI or change bindings. Before any separately approved inactive upload/activation, reconcile immutable active version, complete remote assets/bindings, physical isolated TEST DB, secret-name/auth inheritance and exact source. Keep --strict. Missing refund.failed subscription requires separate authorization; do not alter either enabled endpoint. Actual signed TEST delivery, duplicate/idempotent ledger readback, failed/partial refund exact-cents reconciliation and independent recovery remain unproven. No new Stripe event is manufactured by this packet.

Gate 10 remains NO-GO until target identities, schemas, hosted security, private recovery, physical device results and isolated signed TEST evidence are accepted, followed by exact-source release approval. No competing candidate or hosting change is needed to prepare these records.
