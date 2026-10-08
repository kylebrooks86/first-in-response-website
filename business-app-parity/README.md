# Coordinated FIRE Business App candidates

Candidate source only; NOT a release or production approval. Work chat is the sole source writer. Regular chat reviews read-only. Business Command Center and calculator are excluded.

`shared/` is the reviewed LIVE application candidate plus local placeholder build configuration. `adapters/` preserves each target's separate source adapters and complete migration history. Authentication/environment/deployment differences are explicit; all business source must remain identical. Do not deploy the generic local Vite configuration or attach LIVE resources to DR/staging.

Run `python materialize.py live /absolute/empty/path` (or doomsday/staging), supply already installed compatible dependencies, then run tests from that materialized directory. No hosting identity, secrets, production DB, uploads, or runtime state are supplied. Materialization refuses an existing path.

Doomsday's prepared authentication adapter is NOT verified against its actual PIN deployment. Storage capability, remote schema/index/journal, governed identity, webhook integration and iPhone visual states remain release blockers. The new uniqueness migration must never run until target-specific collision preflight and rollback backups are reviewed. Historical migrations are copied for isolated simulation; do NOT blindly replay them against existing deployments.

The existing governed DR deployment scripts remain authoritative and unchanged. These candidates are deliberately outside their publish path. See the audit, migration tracking report, safety SQL and QC handoff.
