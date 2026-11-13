# FIRE App Unified Release Policy

## Goal
FIRE is one business application with two deployments:

- Production / LIVE FIRE App
- Independent disaster-recovery deployment

The business application should remain functionally and visually identical across both deployments. Infrastructure-only differences are allowed.

## Allowed differences
Only deployment-specific infrastructure may differ, including:

- authentication provider / owner session implementation
- environment variables and secrets
- Cloudflare bindings, D1/R2 identifiers, worker names, domain names
- Stripe test keys vs live keys
- hosting-specific configuration and deployment scripts

These differences must not change business behavior, pricing, workflows, customer documents, navigation, or UI.

## Shared-core rule
Every release has one FIRE release number and one shared-core fingerprint in `FIRE_UNIFIED_RELEASE.json`.

A release is not synchronized until:

1. shared-core checks pass,
2. the same business changes are applied to Production and Independent deployments,
3. both deployments pass the same functional acceptance checklist,
4. any intentional infrastructure differences are documented,
5. both deployments report the same FIRE release number.

## Change workflow
For every future FIRE improvement:

1. Make the change once in the FIRE shared-core specification/source.
2. Run `npm run release:sync-check`.
3. Run release readiness and parity checks.
4. Apply the same business change to LIVE Production.
5. Apply/deploy the same business change to Independent staging/recovery.
6. Verify both against the same acceptance checklist.
7. Mark the release synchronized only after both pass.

## Do not allow drift
A feature, bug fix, pricing change, wording change, payment rule, estimate rule, contract change, job-report change, or UI change must not remain in only one deployment unless it is explicitly infrastructure-specific.
