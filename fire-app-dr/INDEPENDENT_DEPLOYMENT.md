# FIRE App — Independent Cloudflare Staging Runbook

This source package is the independent-hosting staging copy of the FIRE App recovery build, prepared as release candidate v138. It is designed for a separate Cloudflare Worker, D1 database, and R2 bucket. It does not need ChatGPT sign-in.

The original ChatGPT Sites project identifier has been removed from this copy so it cannot target that project through the saved source configuration.

**Safety boundary:** do not attach the production website domain, reuse a live D1 database, reuse a live R2 bucket, or import business records until the isolated staging app has been reviewed. The first deployment should use only its temporary `workers.dev` address.

## 1. Requirements

- Node.js 22.13 or newer
- A Cloudflare account with Workers, D1, and R2 available
- Wrangler authenticated to the intended Cloudflare account
- A unique owner password (16+ characters recommended)

## 2. Run the source preflight

Before creating or touching any Cloudflare resource, run:

```sh
npm run preflight:independent
```

This checks the Node version, required recovery/deployment files, migration sequence, package scripts, hosting-isolation guardrails, and (when supplied) staging resource environment values. A failure is a stop condition; correct it before deployment.

Then run:

```sh
npm run release:readiness
```

This second gate verifies FIRE pricing, the $150 minimum, server-enforced 50% deposit, scheduling and completion gates, balance-payment timing, review wording, mobile estimate defaults, and independent authentication assumptions. Every check must pass before staging deployment.

## 3. Install and create isolated resources

```sh
corepack enable
pnpm install --frozen-lockfile
npx wrangler d1 create fire-app-staging-db
npx wrangler r2 bucket create fire-app-staging-files
```

Record the D1 database ID returned by Cloudflare. Do not use any production database or bucket identifiers.

## 4. Build an isolated deployment configuration

Set these values in the terminal, using the new staging resources:

```sh
export FIRE_WORKER_NAME="fire-app-independent-staging"
export FIRE_D1_DATABASE_NAME="fire-app-staging-db"
export FIRE_D1_DATABASE_ID="PASTE_NEW_D1_DATABASE_ID"
export FIRE_R2_BUCKET_NAME="fire-app-staging-files"
npm run build:independent
```

The script writes `dist/server/wrangler.independent.json`. It refuses missing values and the original placeholder database ID.

## 5. Initialize the empty staging database

Apply each migration once, in filename order:

```sh
for migration in drizzle/*.sql; do
  npx wrangler d1 execute DB --remote --config dist/server/wrangler.independent.json --file "$migration"
done
```

This targets the D1 database recorded in the independent config. Reconfirm that ID in the file before running it.

## 6. Create owner-access secrets

Generate the password hash without showing the password on screen:

```sh
npm run hash:password
```

Copy the resulting hash, then set these Worker secrets. Use a newly generated random session secret of at least 32 characters.

```sh
npx wrangler secret put FIRE_ADMIN_PASSWORD_HASH --config dist/server/wrangler.independent.json
npx wrangler secret put FIRE_SESSION_SECRET --config dist/server/wrangler.independent.json
```

Both secrets are required. No real secret value belongs in the source package or deployment configuration.

### Optional Stripe test-mode setup

Do not configure live Stripe keys during initial staging. If Stripe test mode is being validated, set the test secret key and webhook signing secret as Worker secrets:

```sh
npx wrangler secret put STRIPE_SECRET_KEY --config dist/server/wrangler.independent.json
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config dist/server/wrangler.independent.json
```

Set the Stripe test webhook endpoint to:

```text
https://<staging-workers-dev-host>/api/payments/webhook
```

Subscribe at minimum to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, and `refund.updated`. The webhook signature is verified server-side before FIRE records a payment. Redirect verification remains a fallback, and payment insertion is idempotent by Stripe Checkout Session ID.

If Stripe test mode is not being tested yet, omit both Stripe secrets; manual Cash App, Venmo, cash, check, card, ACH/bank, and other payment recording remains available.

## 7. Deploy to the temporary staging address

```sh
npm run deploy:independent
```

Keep the generated `workers.dev` URL private. Do not connect `firstinresponseexteriors.com` during staging.

## 8. Verify before importing any records

Use `STAGING_ACCEPTANCE_TEST.md` as the formal owner acceptance checklist. Do not import real records until every blocking item is complete.

- An anonymous visit redirects to `/login`.
- An incorrect password is rejected.
- Five incorrect password attempts from the same network trigger a 30-minute application-level block.
- The correct password opens the dashboard.
- Sign out clears the owner session.
- Create a disposable customer and estimate; verify the estimate uses the current pricing and 50% deposit wording. Also verify the intentional owner exception: once approved/signed, the owner may schedule without first collecting the deposit.
- Export a JSON backup and verify merge-only restore behavior using disposable staging data.
- Export the photo archive after uploading a disposable image.
- Add Cloudflare rate limiting or a WAF rule for `/api/auth/login` before broader use.


## Backup compatibility check

Before importing any records, validate the backup file locally:

```sh
npm run validate:backup -- /path/to/fire-app-backup.json
```

The validator accepts either a normal FIRE App JSON export or a verified complete live-database snapshot. A snapshot marked truncated or incomplete is rejected. Record restoration remains merge-only and never overwrites existing record IDs.

## 9. Business-data migration gate

Only after isolated tests pass should the owner explicitly approve importing the latest FIRE JSON backup and photo archive. Import must go to the new staging D1/R2 resources—not the current hosted app. The in-app JSON restore is merge-only: it adds missing records and does not overwrite or delete existing records. Restored checkout-session rows that were `open` in the backup are intentionally normalized to `expired`; a disaster restore must never assume an old remote Stripe checkout is still safe to use. Photo archive restore also honors manifest-declared missing source objects instead of failing the entire archive, and verifies the restored D1 metadata after each R2 upload.

The records-restoration tool is also merge-only and defaults to a dry run. Run the dry check first:

```sh
npm run restore:records -- --backup fire-app-records-backup-YYYY-MM-DD.json --remote --config dist/server/wrangler.independent.json
```

Review the target database and summary. To apply it, repeat the command with both `--apply` and the exact database confirmation printed by the dry run:

```sh
npm run restore:records -- --backup fire-app-records-backup-YYYY-MM-DD.json --remote --config dist/server/wrangler.independent.json --apply --confirm-database fire-app-staging
```

The photo-restoration tool is also merge-only and defaults to a dry run. Run the dry check first:

```sh
npm run restore:photos -- --archive fire-app-photo-archive-YYYY-MM-DD.zip --remote --config dist/server/wrangler.independent.json
```

Review the target database, target bucket, and summary. To apply it, repeat the command with both `--apply` and the exact bucket confirmation printed by the dry run:

```sh
npm run restore:photos -- --archive fire-app-photo-archive-YYYY-MM-DD.zip --remote --config dist/server/wrangler.independent.json --apply --confirm-bucket fire-app-staging-files
```

The tool skips existing photo IDs, skips photos whose customer record is missing, refuses unsafe archive paths or invalid metadata, refuses to overwrite an existing R2 object, and inserts metadata only after the corresponding file upload succeeds.

## Rollback

Because this setup has separate resources and no production domain, rollback is simply stopping use of the staging URL. Do not delete staging resources until any test exports have been preserved and the target identifiers have been rechecked.

## 11. Capture independent parity evidence

After isolated staging is deployed, the parity fixture is loaded, and staging acceptance passes:

1. Generate the current worklist:
   `npm run parity:capture:queue`
2. Work through `PARITY_CAPTURE_QUEUE.md` in capture-group order.
3. Use only isolated staging and disposable `parity-*` fixture records.
4. For every independent screenshot, match the target LIVE capture profile shown in the queue when available.
5. Dry-run registration first, using the exact current release/fingerprint/profile metadata.
6. Apply only after the dry run shows the correct state and destination.
7. Compare only after both LIVE and independent evidence exist.
8. Run the evidence-file check, strict-parity gate, progress generator, and evidence-seal check after each batch.

Current registration shape:

```sh
npm run parity:evidence:register -- \
  --id <parity-id> \
  --side independent \
  --file <screenshot> \
  --source-label <staging-session> \
  --source-release v138 \
  --source-fingerprint <CURRENT_SHARED_CORE_FINGERPRINT> \
  --route-family <parity-id> \
  --device-class mobile|tablet|desktop \
  --orientation portrait|landscape \
  --viewport-width <px> \
  --viewport-height <px> \
  --pixel-ratio <number>
```

Apply by adding `--apply`.

Comparison:

```sh
npm run parity:evidence:compare -- --id <parity-id> --result identical|mismatch --notes "<meaningful comparison notes>" --apply
```

Then:

```sh
npm run parity:evidence:files
npm run release:strict-parity
npm run parity:progress
npm run release:evidence-seal
npm run release:evidence-seal:check
```

Do not mark a state identical merely because both screenshots exist. The comparison must be bound to the exact registered hashes, capture profiles, source release/fingerprint, and route family.
