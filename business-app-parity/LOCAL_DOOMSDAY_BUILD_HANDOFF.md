# Current Doomsday candidate local build path — October 9, 2026

Resumed 2da38b0eec6d3f1faebe59b453ad7aa2188e608e with clean checkout and matching remote head. FIRE Business App only.

Added prepare_local_doomsday.py, a local-only preparation/inspection tool. It invokes the existing authoritative materializer to copy current shared source plus the independent Doomsday adapter and migration history. It creates a fresh destination only, reuses explicitly supplied installed dependencies without installation, and changes only local build configuration: Worker/database names fire-doomsday-local, placeholder D1 identity, no R2. It neither builds nor deploys nor runs migrations itself. The original governed prepare/deploy scripts, historical source and sealed archive remain unchanged.

The prepared app contains current Insights/weather and all existing shared candidate fixes, while retaining independent owner authentication. Source hashes and local-config hash are saved in LOCAL_DOOMSDAY_BUILD.json. The --verify-build mode reads that manifest and generated dist/server/wrangler.json, rejects changed prepared source/configuration or unexpected Worker/D1 identity and R2/vars/service/KV/route bindings. This guard establishes local source/config integrity, not signed deployable provenance.

Local reproduction, using an empty destination and already installed compatible node_modules:

```sh
python -B business-app-parity/prepare_local_doomsday.py /absolute/new/candidate --dependencies /absolute/installed/node_modules
```

Run the auth test, TypeScript and build from the generated candidate directory. Then inspect the generated local configuration from the repository:

```sh
python -B business-app-parity/prepare_local_doomsday.py /absolute/new/candidate --verify-build
```

Never publish this placeholder configuration. No real resource identity, credential or binding is supplied. The candidate PIN input/label differs from deployed login; configured hash/session compatibility and remote auth schema are unverified. No R2 deliberately preserves the current independent D1-only capability, so photo upload/recovery remains unavailable and cannot count as functional parity.

Verification: 5/5 preparation/guard tests; existing destination and dangling symlink preservation; invalid dependencies; rejection of real-resource drift, unexpected resources/vars/routes and changed source. Auth 21/21 assertions, Doomsday TypeScript 1/1 and build 1/1 pass. Build complete confirmed. Generated configuration passes the guard with no real resources connected. Shared application hashes match 118/118 against LIVE/staging candidates. Evidence and local snapshot identity are in LOCAL_DOOMSDAY_BUILD_EVIDENCE.json and CANDIDATE_COMMITS.json. No unchanged financial/photo suites or LIVE/staging builds rerun.

No deployment, remote migrations, database or Stripe write, credential change, storage activation or paid services. Formal deployed/mobile parity remains 0/32 (0%); complete remote schemas 0/3 (0%); production readiness 3/10 (30%), NOT READY.

Next bounded task: align the independent candidate login PIN input/label with the existing deployed four-digit flow using synthetic configured hashes only, then verify login response/session/rate-limit behavior in isolated tests. Do not copy legacy embedded credential material or change deployed secrets. The actual deployed Worker identity, resource isolation, remote schema, sandbox routing, mobile light/dark evidence, storage equivalence and rollback/release authorization remain blocking. Stop after the development-branch save.
