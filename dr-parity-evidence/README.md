# FIRE DR Persistent Parity Evidence

This directory is the persistent home for formal DR parity evidence state that must survive reconstruction of `fire-app-dr` from the sealed v138 archive.

## Rules

- `PARITY_EVIDENCE_MANIFEST.json` is the canonical persistent parity ledger once copied here.
- Independent evidence files belong under `dr-parity-evidence/independent/`.
- LIVE evidence remains governed by the existing sealed v138 baseline unless deliberately re-captured and registered.
- Rebuilding `fire-app-dr` must restore the persistent manifest after sealed extraction.
- Registering independent evidence may change only the independent evidence status/object for the selected state. It must **not** automatically mark the comparison `VERIFIED_IDENTICAL`.
- A state may become `VERIFIED_IDENTICAL` only after a deliberate same-state LIVE-vs-DR rendered comparison.
- Evidence files must retain SHA-256, byte count, notes, source environment, and registration timestamp.

The persistent evidence overlay exists specifically so new DR captures are not lost when the sealed recovery package is re-extracted.
