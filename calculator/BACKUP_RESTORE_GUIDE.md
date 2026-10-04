# FIRE Business Calculator — Backup / Restore Guide

## Goal

Either deployment must be able to take over using the same calculator-data schema and backup format.

## Shared data categories

The backup format must include every calculator-owned item that can affect future use, including where implemented:

- current estimate draft
- customer/job name and notes
- service quantities
- approved/custom rates
- minimum-job rule
- deposit percent
- discounts / override state
- SH/mix settings
- X-Jet/injector calibration
- equipment planner state
- timer/weather settings
- quick-mix favorites
- mix history
- chemical inventory
- custom chemicals
- theme/settings
- version/schema metadata

## Schema rules

1. Production and DR use the same schema version.
2. Shared field names and meanings may not differ by deployment.
3. Infrastructure IDs must not be embedded as required calculator-data fields.
4. Unknown future fields should be preserved when safely possible rather than silently discarded.
5. Migration code belongs to shared core if it changes calculator data semantics.
6. A restore must never substitute guessed pricing for an unapproved rate.

## Export acceptance test

Using disposable staging data:

1. Fill representative values in every shared data category.
2. Export from production staging.
3. Record release version and shared-core fingerprint.
4. Inspect that the backup declares its schema/version.
5. Restore into DR staging.
6. Reload DR staging.
7. Compare every restored value and generated total.
8. Export again from DR staging.
9. Restore that file into production staging.
10. Compare every restored value and generated total again.

Both directions must pass before synchronization can be declared.

## Invalid backup handling

Test at minimum:

- malformed JSON
- missing schema/version
- unsupported future schema
- missing optional fields
- wrong data types
- negative values in nonnegative fields
- unknown service IDs
- corrupted rate values

The application must fail safely, preserve existing data where appropriate, and provide the same user-visible error behavior in both deployments.

## Pre-restore safety

Before replacing existing calculator state, create a pre-restore snapshot whenever the platform supports it. If automatic snapshotting is unavailable, clearly warn before replacement.

## Recovery takeover

When primary hosting is unavailable:

1. Open the synchronized DR deployment.
2. Confirm expected version/fingerprint.
3. Restore the newest compatible backup if needed.
4. Verify one known estimate total against the backup/source record.
5. Verify rates, minimum job and deposit percent.
6. Verify save/reload.
7. Continue normal field operation.

## Current status

Cross-deployment backup/restore has **NOT YET BEEN VERIFIED** under the new dual-deployment model. Do not mark it complete until the staging round-trip test passes.
