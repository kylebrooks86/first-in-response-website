# FIRE Business Calculator — Disaster-Recovery Deployment Guide

## Objective

Deploy the exact same FIRE Calculator Core to two independent environments:

1. Production / Live
2. Disaster Recovery / Doomsday

The DR deployment must remain fully usable for normal calculator operation without ChatGPT, OpenAI authentication, OpenAI model calls, or OpenAI hosting.

## Non-negotiable rule

The deployments may differ only in infrastructure adapters. Shared-core files must be byte-identical and must produce the same shared-core fingerprint.

## Shared core

The authoritative shared-core file list and fingerprint are in `SHARED_CORE_MANIFEST.json`.

Any file that can change UI, pricing, formulas, service logic, validation, navigation, saved state, export contents, error handling, or business rules belongs to shared core.

## Infrastructure adapters

Allowed differences include:

- domain / URL
- hosting provider
- service worker or asset-cache strategy when it does not alter normal calculator behavior
- environment variable values
- secrets
- storage/database identifiers
- backup destination
- deployment credentials

Infrastructure adapters must never inject, remove, reorder, restyle, or recalculate shared calculator behavior.

## Deployment sequence

1. Build one release from FIRE Calculator Core.
2. Generate `SHARED_CORE_MANIFEST.json` and fingerprint.
3. Run formula regression suite.
4. Deploy the exact shared-core package to staging production adapter.
5. Deploy the exact shared-core package to staging DR adapter.
6. Verify both deployments report the exact same shared-core fingerprint.
7. Execute `STAGING_ACCEPTANCE_CHECKLIST.md` route-by-route and state-by-state.
8. Update `PARITY_MATRIX.md` only with evidence-backed status changes.
9. Export disposable staging data from one deployment and restore it into the other.
10. Disconnect/disable ChatGPT/OpenAI dependencies and verify DR still operates normally.
11. Perform physical iPhone offline test on DR.
12. Only after all gates pass may the same release be promoted to production/live.

## Takeover procedure

If primary hosting disappears:

1. Do not rebuild calculator logic.
2. Use the most recent synchronized release package whose fingerprints matched production and DR.
3. Activate the DR host/domain or provide its existing URL.
4. Restore the latest compatible calculator-data backup if needed.
5. Verify the displayed version and shared-core fingerprint.
6. Run a reduced smoke test: launch, SH Mix, one Equipment calculation, one Job Math quote, save/load, export/restore, dark/light mode, iPhone layout.
7. Declare takeover only after the smoke test passes.

## Data portability

Both deployments must use the same storage schema and backup JSON format. Infrastructure-specific storage identifiers are allowed, but exported user data must be portable without manual field conversion.

## Prohibited recovery shortcuts

- copying only visible HTML while leaving formulas different
- maintaining a separate DR pricing table
- adding DR-only calculator features
- hard-coding a different default state in DR
- silently dropping fields during restore
- requiring ChatGPT/OpenAI to perform normal calculations
- calling two builds “identical” because both display the same version number

## Current state

Current status is **NOT SYNCHRONIZED**. This guide defines the target deployment model; it does not certify the current two calculators as identical.
