# FIRE — owner Acer confirms TEST private customer route redirects to Cloudflare Access login (Nov 15, 2026)

**Origin:** Original owner-supplied Acer Windows PowerShell photo `IMG_7F42FE31-CF36-4AF9-86A4-445BE45CD0DC.jpeg`, **373,840 bytes**, SHA-256 **`10d52c2827b004f6ce8428bbfde95fbcbb80a9be9c911e754688c17c9c7e1996`** calculated from the currently uploaded original bytes. The screenshot remains in the owner conversation; GitHub stores evidence metadata, not the image. The original screenshot contains historical DR/NEW LIVE 404 GETs and earlier TEST webhook 405/private 302 checks in the terminal scrollback. Those are already accepted historical evidence, not newly repeated checks.

**NEW read-only verification shown at bottom of screenshot:** The owner used an anonymous curl GET with `--max-time 12 --max-redirs 0 -D - -o NUL` for `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/customers`, filtered the returned status and `Location` header, then printed only the redirect URI's **hostname and path**. The test did **not** follow the redirect, reveal cookies/tokens/query parameters, authenticate, POST a payment, or write any provider state.

**Observed actual response:**
- Status: **`HTTP/1.1 302 Found`**.
- Redirect HOST: **`restless-unit-ad5b.cloudflareaccess.com`**.
- Redirect PATH: **`/cdn-cgi/access/login/fire-stripe-test-20261101.kyle-bfc.workers.dev`**.
- Redirect query parameters were not printed; no secrets stored in repository.

**Interpretation (newly resolved):** This directly confirms that the **anonymous TEST Worker private `/api/customers` request is routed to a Cloudflare Access login flow** at the observed time. It is no longer an unverified application-level 302 hypothesis. Earlier real owner Worker's Access tab independently showed **Worker Access: All traffic** / require login on production and previews with `FIRE Stripe TEST - Owner Only`, an exact-owner-email **Allow** Include. Together these confirm a functioning *unauthenticated login interception* for the private customer path, not end-to-end owner sign-in/nonowner denial or access JWT validation in app code.

**Important contrasting result already established:** A separate prior **anonymous GET** to the **same TEST Worker** `/api/payments/webhook` returned **HTTP 405** rather than a Cloudflare login redirect. This remains **consistent with** an existing path-specific webhook exception, but does **NOT** confirm saved effective Worker Access destination `overrides`, headers/source bytes for the webhook 405, successful/authorized **Stripe-signed POST**, ledger/refund exact-cent reconciliation, or absence of unintended broader public exemptions. Do not run previously prepared source `owner_add_exact_gate9_webhook_access_override.ps1` to add an override on guesswork; it is PREPARED ONLY and not owner-authorized.

**Remaining distinct evidence needed:** Read-only provider inspection of the **current saved** TEST Worker Access destination/path-override inventory, with no configuration edits, then separately approved genuine Stripe TEST signed webhook delivery and fail-closed ledger/refund verification. Do **not** repeat either earlier successful GET status comparison or this redirect proof. Do not expose/change DARK DR or NEW LIVE, repeat their accepted 4×404/URL OFF/isolated D1/version checks, use repeated Wrangler sign-in, enable Access bypass, change Stripe, deploy, merge, migrate, or subscribe to Cloudflare/R2.

**Formal release state unchanged:** G1/G2/G3/G8 accepted 4/10; G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK NO-GO. No owner/provider write in this evidence capture.
