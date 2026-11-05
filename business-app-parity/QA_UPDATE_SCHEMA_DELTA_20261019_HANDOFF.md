# FIRE full-app QA update — exact schema delta and code-only hold

Candidate source checkpoint: `3d2c9f05e038c15e7ef0d372fd0af5d26bb7ca0b` (7/7 completed CI at [39293271806](https://github.com/kylebrooks86/first-in-response-website/actions/runs/39293271806)).
First successful synthetic full-app QA source pinned in the existing Windows updater: `f650d25b18d23bc9f71a4d55c9322bfd5870ef75`.

**Read-only source finding:** The QA materializer inherits the Doomsday SQL history. All 23 historical `0000`–`0022` SQL files retain their original exact Git blob IDs. The latest candidate includes two NEW additive source files, `0023_deposit_policy_events.sql` and `0024_deposit_agreement_snapshots.sql`, for **25 candidate SQL files**.

The existing `owner_windows_qa_update_review.ps1` and `owner_windows_qa_update_publish.ps1` correctly refuse a code-only update because the original hosted QA build had 23 migration files. **DO NOT weaken those checks or use an ordinary update-publish path.** No remote QA migration journal or table data has been read to verify whether these new tables exist.

`review_qa_update_schema.py` verifies both local migration trees byte-for-byte against Git blob hashes from the pinned original deployment and the exact two additions. It emits a *not-authorized* JSON review packet; it never runs migrations, sends API requests or changes any files.

Read-only usage on the owner's existing Acer Windows checkout after the new QA candidate has been compiled, from the repository root:

```powershell
python.exe business-app-parity/review_qa_update_schema.py --baseline "$env:LOCALAPPDATA\FIRE-QA-Builds\qa-f650d25b18d23bc9f71a4d55c9322bfd5870ef75\drizzle" --candidate "$env:LOCALAPPDATA\FIRE-QA-Builds\qa-3d2c9f05e038c15e7ef0d372fd0af5d26bb7ca0b\drizzle" --checkpoint 3d2c9f05e038c15e7ef0d372fd0af5d26bb7ca0b
```

The command compares local archived candidate assets only. A passing result means `CODE_ONLY_QA_UPDATE_BLOCKED`, not permission to publish. If it cannot find the archived first-release directory, stop. Never reinitialize or overwrite the current QA database or the owner's local encrypted backups.

Before any hosted QA update: obtain authenticated READ-ONLY D1 migration journal and schema evidence for the exact isolated QA UUID (not LIVE/staging/Doomsday), check a recoverable backup, independently review additive migration effects and rollback limits, and get separate explicit owner approval identifying the exact migrations, target Worker/D1 and source commit. Do not use the historical initial-publish script. The existing production release acceptance is still **3/10 (30%)**.

Other findings are positive but limited: current candidate `3d2c9f05e038c15e7ef0d372fd0af5d26bb7ca0b` passed the complete local synthetic browser, LIVE/staging/Doomsday candidate build and source-parity CI suite; Customer View, invoice, Job Costs and Job Report mobile improvements are still not present in the hosted iPhone app.
