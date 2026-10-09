# Candidate review manifest and progress reporting — October 9, 2026

Resumed b4a14c9bff3f8e44dd9106c08c5008cf37458fc4 with clean local checkout and matching remote development head. FIRE Business App only.

Added candidate_release_manifest.py and CANDIDATE_RELEASE_MANIFEST.json to bind the current shared source, exact target adapters/absence lists, materialized candidate files, migration sets and review input files to SHA-256 hashes. These are working-tree source fingerprints, not signed release or deployed build identities. Generic candidate hosting configuration is still a local placeholder and must not be published. The original governed deploy path and rollback archives remain unchanged.

The generator validates contiguous migration numbering and shared application equality outside the nine explicit adapters. It produces a deterministic source manifest, records distinct target fingerprints, and always marks productionReady/publicationAuthorized/deployed false. Verification detects changed source, adapters, migration history, review input or manifest contents. Generation refuses an existing output; retain prior manifests rather than overwrite them. Source symlinks, unsafe absence paths and inconsistent progress percentages fail closed.

Read-only verification:

```sh
python -B business-app-parity/candidate_release_manifest.py business-app-parity/CANDIDATE_RELEASE_MANIFEST.json --verify
```

After a source/input change, this saved snapshot is expected to fail verification until a fresh review manifest is deliberately generated and reviewed. This is useful stale-source detection, not a release approval. Migration filenames/hashes here do not prove remote application, journal safety or resource isolation. Prior local candidate snapshot commits remain in CANDIDATE_COMMITS.json; no runtime candidate changed in this batch.

Five relevant tool tests pass, covering deterministic generation, forged approval, source/migration drift, migration gaps, unsafe absence paths, symlinks, inconsistent readiness and unapproved target dashboard divergence. Actual manifest verifies against current source/review inputs: 118 common application files match; LIVE/DR/staging migration counts are 21/23/21. AGENTS.md and FIRE_PARITY_POLICY.md remain byte-identical (2/2). No unchanged app/auth/financial/photo tests or builds repeated. Exact manifest/tool hashes are in CANDIDATE_RELEASE_MANIFEST_EVIDENCE.json. JSON and diff checks pass.

User requested an overall percentage with every update. Both governing policy files and PROGRESS_STATUS.json now require overall verified readiness: passed production release gates / total gates, currently 3/10 (30%). This is evidence-based readiness, not effort completed or time remaining. Candidate-only improvements must not inflate it. Keep source/test/deployed/mobile percentages separate.

Overall verified readiness 3/10 (30%), NOT READY. Formal deployed/mobile parity 0/32 (0%); complete remote schemas/journals 0/3 (0%). No deployment, remote resource/database/Stripe mutation, secret change or paid service occurred.

Next bounded batch: compare the accessible authenticated staging and Doomsday customer navigation flow read-only (Customers → existing profile → Back/Home), capturing concrete presentation/flow differences without modifying records or starting payment/refund actions. Use supported browser controls; desktop captures cannot substitute for mobile evidence. Avoid repeating blocked identity endpoints. Remote identity/schema, auth configuration, photo capability, sandbox integration, actual mobile/dark evidence and rollback approval remain release blockers. Stop after the branch save.
