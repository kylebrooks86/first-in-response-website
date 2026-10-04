# FIRE App v138 — Security and Recovery Status

## Implemented

- Owner password authentication with signed secure session cookie.
- Application-level login throttling.
- Random private customer estimate/invoice tokens.
- Owner-authenticated customer-photo endpoints.
- Merge-only JSON and photo restoration with dry-run-first remote apply safeguards.
- Exact target database/bucket confirmation before remote restore writes.
- Restore relationship, identity, provider-collision, refund-ledger, and photo-object integrity checks.
- Current database migration chain is **21 contiguous migrations: 0000 through 0020**.
- Payment/refund recovery includes pending-refund safety holds and refund-ledger uniqueness.
- Release evidence files are SHA256/size/provenance validated.
- Current release evidence seal protects authoritative recovery/parity governance and captured evidence.
- Canonical recovery-package policy excludes stale versioned release history and transient build/runtime directories.

## Required before external staging

- New isolated Cloudflare Worker.
- New isolated D1 database.
- New isolated R2 bucket.
- Apply migrations `0000` through `0020` in order.
- Configure unique owner password hash and random session secret through Worker secrets.
- Keep the temporary `workers.dev` address private during acceptance.
- Use only disposable records until acceptance passes.

## Stripe

Initial staging must not use live Stripe keys.

When Stripe test mode is deliberately enabled:
- configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets;
- use the signed `/api/payments/webhook` endpoint;
- test checkout completion and refund convergence only with Stripe test data.

## Intentionally unfinished

- Production/LIVE synchronization remains pending.
- Strict rendered parity is not yet fully verified.
- Real customer-data import requires explicit owner approval after isolated staging acceptance.
- Production domain/DNS must remain unchanged during staging.
