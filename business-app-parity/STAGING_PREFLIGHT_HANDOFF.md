# Staging preflight batch — October 9, 2026

Resumed af756f6d5d853468aa48b21d651e9c9d341af626 on work/fire-business-app-parity-2026-10-08. Remote head matched the requested checkpoint; the new workspace had no existing checkout or local edits. Cloned the existing branch and confirmed a clean working tree. Read all six requested handoffs before selecting this bounded read-only task.

## Verified evidence

Native Sites inventory/get-site identifies refund staging project appgprj_6ac7e8e358dc81918d0a47c4034c4a41 at https://fire-live-refund-staging.kylebrooks8605.chatgpt.site, public access, latest saved version 3. Native deployment status confirms that version's publish succeeded with environment revision 2. Saved source commit is f7ed28a5d13ada738f5663e4f55a45c5d794c21e; it predates current candidate fixes. Exact version/deployment IDs and archive hashes are in STAGING_PREFLIGHT_EVIDENCE.json.

Runtime configuration revision 2 confirms FIRE_ENV=staging and SITE_ORIGIN equals the staging URL. STAGING_SETUP_SECRET, STRIPE_RESTRICTED_KEY and STRIPE_WEBHOOK_SECRET exist but their values are masked. Presence does not verify sandbox key mode, signing-secret pairing or webhook destination.

The native read-only D1 overview succeeds: exact binding DB, 19 table names, no omitted identifiers. payment_checkout_sessions and payment_refunds exist. This is new partial remote access evidence, not full schema verification: no columns, indexes, journals, D1 resource identity, synthetic-only record check or isolation from LIVE/DR was established. No customer/financial rows were retrieved.

One read-only Doomsday /api/app-version request returned HTTP404. No retry loop or authentication change. Cloudflare schema access for that independent Worker remains unavailable through the exposed connector.

Saved version 3 and its source/archive are identified as a potential staging code rollback. Versions 1 and 2 also have archives. No restore was attempted; code rollback does not roll back runtime variables, database migrations or records. Database backup/restore readiness remains unverified.

## Validation and scope

This batch changes evidence and handoff/status documentation only. Application source, adapters, migration histories, candidate commit IDs and previous passing results remain unchanged. Content consistency, required table-name presence, secret redaction, all eight preflight check counts, JSON parsing and git diff --check are checked before saving. No application, build or photo-recovery tests need rerunning.

Preflight checks are explicitly scoped: project/published-version identity, staging runtime label/origin, and saved code rollback identified pass (3/8, 37.5%). Remaining: independent D1 resource identity, remote columns/indexes/journals, sandbox credentials/webhook routing, synthetic-only data verification, validated rollback restore. Stage update remains blocked.

Candidate shared source stays 118/118 (100%, prior result); formal deployed/mobile comparisons stay 0/32 (0%); complete remote schemas stay 0/3 (0%); production-readiness gates stay 3/10 (30%), NOT READY.

No Sites source credential, save/deploy, secret update, database write/migration, Stripe API call, charge/refund, event replay, storage activation or paid resource occurred. Existing LIVE/Doomsday/staging publications and rollback copies are unchanged. The previously observed sandbox endpoint pointing to LIVE remains a historical blocker; its inventory was not re-audited here.

## Next bounded batch

Use available read-only Sites database inspection to obtain staging columns and compare them with candidate schema; verify D1 resource isolation and migration indexes/journal through an appropriate authenticated read-only surface if available. Do not infer complete schema safety from table names. Then recheck isolated sandbox endpoint/key pairing before proposing any exact staging candidate release. If access blocks, move to one remaining candidate mobile UI gap without repeating completed audits. No owner action is needed for this evidence save.

Independent QC may review this evidence/status/handoff for unsupported readiness claims. This batch stops after the branch save.
