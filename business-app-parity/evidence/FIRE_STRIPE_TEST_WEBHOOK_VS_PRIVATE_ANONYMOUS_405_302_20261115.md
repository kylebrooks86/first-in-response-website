# FIRE Gate 9 — owner Acer observed TEST webhook-vs-private-route status contrast (Nov 15, 2026)

**Source and custody:** Real owner-supplied Acer Windows PowerShell photograph `IMG_7733BE57-15B6-4BC9-BFED-FCB6C891C646.jpeg`, original image **348,418 bytes**, SHA-256 **`9572d3c022d9c83758986f65cc9ee68403a32573ee5f6cf5948ccf1dfd8ed509`**, computed from the exact uploaded bytes in the current conversation. Image remains owner-supplied in ChatGPT, not copied to GitHub. This is unauthenticated HTTP evidence, not a Cloudflare provider-attested Access override inventory or signed Stripe delivery receipt.

**New actual command visible at bottom of screenshot:**
```powershell
curl.exe -sS --max-time 12 --max-redirs 0 -o NUL -w "HTTP=%{http_code}`n" "https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/customers"
```

**Observed:** The newly requested single anonymous no-redirect GET to the TEST Worker **`/api/customers` returned `HTTP=302`** (the output appears immediately above the returned `PS C:\Users\Kyleb>` prompt). The previously captured, different request to the SAME TEST Worker **`/api/payments/webhook` returned `HTTP=405`** and appears above this result in the same photograph, with prior owner image provenance in [`FIRE_STRIPE_TEST_WEBHOOK_ANONYMOUS_GET_405_20261115.md`](FIRE_STRIPE_TEST_WEBHOOK_ANONYMOUS_GET_405_20261115.md).

| TEST Worker anonymous GET | Observed status | Verified scope |
| --- | --- | --- |
| `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook` | **405** | Prior existing TEST webhook GET, method rejected, no redirect followed |
| `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/customers` | **302** | **NEW** owner Acer read-only anonymous private-path probe, no redirect followed |

**Security interpretation, with strict limits:**
1. **Concrete route-contrast evidence**: the TEST Worker treats the two anonymous GET paths differently. A POST-only webhook source route could emit 405, while a private customer route protected by owner-only Cloudflare Access could return a 302 sign-in redirect. This is consistent with path-scoped public-webhook handling and separate private-route protection; not proof the responses originate from those respective layers.
2. The screenshot captures only HTTP status. It does **not** capture the `Location` header, response body, current saved Cloudflare worker destination `overrides` array, method-specific POST behavior, signed Stripe deliveries, exact-cent refund/checkout D1 reconciliation, actual authenticated owner/nonowner denies, or hosted Worker source-byte identity. **Do not assert Access 302 destination or a deployed path override is definitively verified.**
3. Previously accepted real Cloudflare Worker > Access screenshot shows `Worker Access / All traffic`, `Require login on every URL` and a reusable exact-business-email `Allow` policy for the TEST Worker. The source repo contains a PREPARED-ONLY, owner-authorization-required guarded exact webhook Access exception helper. **Do NOT run the helper** on the basis of these statuses; the comparison suggests the exception might already be active and any blind PUT would be especially dangerous.
4. The correct next step, if needed, is a **different** read-only provider inspection of saved TEST Worker Access destination overrides (or exact 302 `Location` header via a bounded no-cookie GET without following redirects). Do not repeat these successful status checks. An actual signed TEST Stripe POST and provider-delivery/ledger receipt are separate requirements and need distinct authorization. Never send unsigned or fake Stripe POST payloads to claim a real delivery.
5. Existing DARK DR and NEW LIVE URLs, D1 UUIDs, first-create locks, original screenshots and anonymous 4×404 checks remain accepted and untouched. No Cloudflare/Access config, Stripe endpoint/payment/refund, SQL/D1, paid Cloudflare/R2, deployment, domain/DNS or merge was modified.

**Formal status:** G1/G2/G3/G8 accepted = 4/10. G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK NO-GO. This new result strengthens one Gate 9 network-boundary subcheck but does not close Gate 9.
