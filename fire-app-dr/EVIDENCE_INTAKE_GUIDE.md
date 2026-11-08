# FIRE App v138 — Parity Evidence Intake Guide

## Purpose
The LIVE FIRE business app remains the master target. Parity proof now has two separate steps:

1. Register the exact LIVE and independent evidence files.
2. Compare those registered files and save a hash-bound verdict.

A screenshot being present is not the same as a verified match.

## 1. Generate the capture queue

```bash
npm run parity:capture:queue
```

Use `PARITY_CAPTURE_QUEUE.md` as the current worklist.

## 2. Register LIVE evidence

Dry run first:

```bash
npm run parity:evidence:register -- --id <parity-id> --side live --file <screenshot> --source-label <live-deployment/session> --device-class mobile|tablet|desktop --orientation portrait|landscape --viewport-width <px> --viewport-height <px> --pixel-ratio <number>
```

Apply:

```bash
npm run parity:evidence:register -- --id <parity-id> --side live --file <screenshot> --source-label <live-deployment/session> --device-class mobile|tablet|desktop --orientation portrait|landscape --viewport-width <px> --viewport-height <px> --pixel-ratio <number> --apply
```

## 3. Register independent evidence

Dry run first:

```bash
npm run parity:evidence:register -- --id <parity-id> --side independent --file <screenshot> --source-label <independent-deployment/session> --device-class mobile|tablet|desktop --orientation portrait|landscape --viewport-width <px> --viewport-height <px> --pixel-ratio <number>
```

Apply:

```bash
npm run parity:evidence:register -- --id <parity-id> --side independent --file <screenshot> --source-label <independent-deployment/session> --device-class mobile|tablet|desktop --orientation portrait|landscape --viewport-width <px> --viewport-height <px> --pixel-ratio <number> --apply
```

Registering or replacing either side always resets the comparison to `PENDING` and deletes the old comparison record.

## 4. Save the comparison verdict

Both files must already be registered and SHA256-valid.

Dry run:

```bash
npm run parity:evidence:compare -- --id <parity-id> --result identical --notes "Exact visible layout, copy, controls, and state behavior match."
```

Apply:

```bash
npm run parity:evidence:compare -- --id <parity-id> --result identical --notes "Exact visible layout, copy, controls, and state behavior match." --apply
```

For a mismatch:

```bash
npm run parity:evidence:compare -- --id <parity-id> --result mismatch --notes "Describe the exact visible or behavioral difference that must be fixed." --apply
```

The comparison record stores the exact LIVE SHA256 and independent SHA256 it was made against. If either registered screenshot later changes, strict parity fails until a new comparison is performed.

## 5. Re-run gates

```bash
npm run parity:evidence:files
npm run release:strict-parity
npm run parity:capture:queue
```

## Disabled legacy workflow

`parity:evidence:intake` is intentionally disabled. It previously mixed evidence registration and comparison status in one command and is not accepted for current parity proof.

## Rule

`VERIFIED_IDENTICAL` is allowed only when:
- both actual evidence files are registered;
- both files still match their recorded SHA256 and byte size;
- a saved comparison record references those exact file hashes;
- comparison notes explain the basis for the verdict.

`FULL_IDENTICAL` remains impossible while any required state is pending or mismatched.


## Evidence provenance — v127

Every newly registered evidence file must include `--source-label`.

Examples:
- `live-master-2026-10-01`
- `independent-staging-v127`
- `independent-staging-mobile-viewport`

The label is stored with the evidence hash and registration timestamp. Comparison records copy both source labels and both registration timestamps, so a verdict cannot silently survive evidence from a different deployment/session.

After each capture or comparison batch run:

```bash
npm run parity:progress
```

This regenerates:
- `PARITY_PROGRESS.json`
- `PARITY_COMPARISON_QUEUE.md`


## Capture profile — v138

Every new screenshot registration must describe the rendered context:

- `--device-class mobile|tablet|desktop`
- `--orientation portrait|landscape`
- `--viewport-width <CSS px>`
- `--viewport-height <CSS px>`
- `--pixel-ratio <number>`

For states that already have LIVE evidence, `PARITY_CAPTURE_QUEUE.md` prints the target LIVE profile to reproduce for the independent capture.

An `identical` verdict is rejected if LIVE and independent capture profiles differ. Use `mismatch` or recapture at the matching profile.


## Deployment provenance — v138

Every new evidence registration must also include:

- `--source-release <release-label>`
- `--route-family <stable-route-or-state-family>`

For independent evidence intended to prove the current recovery build, `--source-release` must equal the current FIRE release. For this package that is `v138`.

Use the parity state ID itself as the stable `--route-family` unless the capture runbook explicitly defines another stable family.

An `identical` verdict is rejected if:
- the LIVE and independent route families differ; or
- the independent evidence came from an older recovery release.

This prevents an old independent screenshot from being reused to prove a newer DR build.


## Source package fingerprint — v138

Every new independent evidence registration must use:

- `--source-release v138`
- `--source-fingerprint 2863f0efd18715c523e8a2adffe172e75c1f8d56e72db1b83b6bd1ed44cb17b9`
- the correct `--route-family`

The fingerprint must be copied from `CURRENT_VERSION.json` or `PARITY_CAPTURE_QUEUE.md`.
An identical verdict is rejected if the independent evidence fingerprint does not match the current shared-core fingerprint.

Legacy LIVE captures predate fingerprint recording. They remain valid as historical LIVE evidence, but their fingerprint provenance is explicitly marked `legacy-unknown-not-recorded-at-capture`; it is never represented as the v138 fingerprint.
