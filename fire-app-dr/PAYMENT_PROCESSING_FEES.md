Cash App and Venmo processing-fee tracking

Optional owner-entered processing fee or net deposit. Invoice principal remains payments.amount_cents. Tips use a separate Tip ledger record and are excluded from invoice paid totals, overpayment checks, and refunds of principal. Transaction gross, bundled tip, fee and method are nullable metadata on the principal payment (or standalone tip); net is derived as gross minus fee. Paired tip rows do not duplicate the fee.

Historical rows are not backfilled. Unknown fees remain unknown, and reports identify them as unrecorded. Venmo's 1.9% + $0.10 helper is an estimate, applied only when confirmed. Cash App has no assumed rate. Refunds retain original processor expense; no fee reversal is assumed. Stripe retains its existing flow and fee data.

New nullable migrations: LIVE 0018; DR 0021. JSON and CLI restore preserve added fields, and old backups default them to NULL. DR preparation re-applies a governed idempotent patch after its tipping overlay; migration/provenance count is now 22.

Validation: production builds pass for both sources. LIVE TypeScript passes. DR TypeScript still reports pre-existing optional Cloudflare binding/legacy typing errors. SQLite-backed endpoint tests run real migration SQL, manual-payment requests, invoice revisions, DR external-refund confirmation, signed Stripe webhook + duplicate retry, fee rejection, and JSON backup/restore. No real customer or payment records are used by tests. Mobile controls are scrollable, but authenticated browser/iPhone interaction testing was not performed in this environment.

Run: node scripts/test-processing-fees.mjs
