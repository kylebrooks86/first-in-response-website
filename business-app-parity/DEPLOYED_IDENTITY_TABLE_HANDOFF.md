# FIRE Business App native deployment identity/table review — 2026-10-09

Resumed `857630e20c7cc79203b76971d32ae569976588f7` on `work/fire-business-app-parity-2026-10-08`. Remote matched local HEAD and checkout was clean. The reliability/recovery batch, all prior candidate snapshots and historical evidence are preserved.

## Grounded new finding

The read-only native LIVE D1 overview identifies project `appgprj_6aaf416f82c88191a292fa2e13a9ea61`, binding `DB`, and 18 user tables with every omission count zero. The candidate's preserved LIVE migration output requires 19 tables. **`payment_refunds` is absent from the observed LIVE list.** This is a confirmed candidate-promotion blocker, not proof that the currently deployed legacy app is malfunctioning. No migration or repair was attempted.

Refund staging project `appgprj_6ac7e8e358dc81918d0a47c4034c4a41` has 19/19 candidate table names, including `payment_refunds`, with no omitted identifiers. Names alone do not verify types, constraints, indexes, resource isolation or migration journals. No customer/payment rows were retrieved; prior 163-column inspection was not repeated.

Native Sites metadata still reports latest saved LIVE version 61 (`896b5e4125cb89da729993d1f37127e3b930c79d`) and refund staging version 3 (`f7ed28a5d13ada738f5663e4f55a45c5d794c21e`). Each saved version's latest publish attempt reports succeeded, with environment revisions 9 and 2 respectively. Exact opaque project/version/deployment IDs, source and archive hashes are retained in `DEPLOYED_IDENTITY_TABLE_EVIDENCE.json`. This binds saved source to those publication records, but does not seal current runtime build/routing identity or prove candidate changes have been published.

Independent Doomsday has no exposed Cloudflare deployment/schema connector. The saved reference commit is historical and remains unverified as deployed source. Earlier blocked identity endpoints were not retried. No Sites project ID or successful identity proof was fabricated.

## Local inspection tooling and exact checks

`check-deployed-table-inventory.py` compares saved native overview metadata with target-specific schema created only in disposable in-memory SQLite. It rejects wrong project/binding, incomplete/uncertain projections, duplicates, malformed collections, missing or extra tables and unsupported independent identities. Reports always retain full-schema, isolation, journal and production-ready false.

- New regression tests: **14/14 passed**.
- Actual LIVE comparison: **18/19 (94.7%)**, expected CLI exit **1** for missing `payment_refunds`.
- Actual staging table names: **19/19 (100%)**, CLI exit **0** for names only.
- Two native saved-version/publication records verified out of three target identities; overall identity gate remains incomplete.
- Full remote schemas/journals: **0/3**; formal hosted/mobile comparisons: **0/32**.
- **Overall verified readiness: 3/10 gates (30%); NOT READY.**

Evidence/progress/inventory JSON, tool hashes, metadata redaction, exact candidate inputs and git diff checks were validated. Application runtime/adapters/migrations were unchanged, so previous 3,183/3,183 reliability checks, 42/42 suite runs, 3/3 TypeScript/builds and 119/119 source parity results are retained without redundant reruns. These remain candidate/local results.

LIVE, Doomsday production and refund staging deployments and records are unchanged. No secret inspection/update, migration, cloud write, Stripe call, deployment, service purchase or new automation. Cost **$0**. Overnight runs remain stopped.

## Next bounded batch

Refresh the local-only release review manifest around the latest reliability candidate snapshots and this confirmed LIVE table blocker. Preserve historical manifests and exact target migration histories. Do not use a legacy deploy wrapper or propose publication while identities, schema/resource isolation, auth/photos, mobile/sandbox evidence and rollback/seal remain incomplete. If independent metadata access becomes available, use read-only deployment identity and schema/journal inspection. Stop at this saved checkpoint; no background runs.
