# FIRE Gate9 — real Acer anonymous Stripe TEST webhook GET returns 405 (Nov 15, 2026)

**Actual owner-provided evidence:** original Windows PowerShell screenshot `IMG_AB04E4B7-D5CF-4288-BBC6-EF4ED3851F6D.jpeg`, SHA-256 `c05711f5c78e55d5bb1da9197e41b43b890fcc153c2c40415dec9fd9eebf2ac6`, 348,889 bytes. Source image remains in user conversation, not copied to GitHub. This is a single real anonymous GET probe, not a provider-authenticated Cloudflare routing dump or a signed Stripe POST.

**Exact new invocation shown at bottom of owner PowerShell screenshot:**

```powershell
curl.exe -sS --max-time 12 --max-redirs 0 -o NUL -w "HTTP=%{http_code}" "https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook"
```

**Observed result:** `HTTP=405` (Method Not Allowed), without curl timeout/error visible; no redirect followed, no request body sent. The preceding older `FIRE EXISTING WRANGLER READ-ONLY STOP` and DR/NEW LIVE four 404 checks shown above in the same console are *previously documented historical commands*, not part of this new GET.

**Meaning of the new 405:**
- The exact TEST webhook GET responded with a **method rejection, not a 302 login redirect, 403 Access denial or 404 nonexistent URL**. Current DRAFT PR270 `business-app-parity/shared/app/api/payments/webhook/route.ts` exports **POST** and no GET, so a standard framework-generated 405 is consistent with reaching a POST-only app endpoint. HOWEVER the hosted TEST Worker's actual deployed bytes/source have **not** been provider-attested; we did not collect response headers or body. Do **not** assert with certainty that this 405 came from the source route vs a Cloudflare layer.
- The same earlier real Cloudflare Worker > Access screenshot says **Worker Access All traffic**, login required on production and preview, exact owner-only-email Allow policy. A 405 here is *unexpected under a naive assumption that every anonymous request must be redirected*. It **raises the possibility of an already-existing exact-path public Access override**, but does NOT prove an override is installed, or that POST is permitted, signed Stripe TEST delivery works, or refunds reconcile in the ledger. A proposed exact-path override exists in GitHub source `cloudflare-launch/stripe-test-worker/owner_add_exact_gate9_webhook_access_override.ps1` as **PREPARED ONLY / NOT APPROVED TO RUN**. Its presence in source is NOT proof a provider change occurred; do not execute the script without exact owner approval.
- Do not weaken the existing owner-only Worker Access, infer broad bypass, or prematurely close Gate9. The safer NEXT *distinct* owner check is one read-only anonymous GET to the **same Stripe TEST Worker** but an **owner-private path `/api/customers`** (never previously probed for this TEST Worker). Compare its status with this already captured 405; a 302/403/401 would support path-specific separation but still require actual provider override inventory and signed POST proof. No reason to repeat this exact webhook GET. A separate current Cloudflare Access provider GET can inspect worker destination overrides if authenticated read-only access is available without repeated Wrangler login.
- This request made **no** D1/SQL, Stripe payment/webhook event, Worker deploy, Cloudflare/Access policy, R2, DNS, OAuth, merge or production change. No live user/Stripe secrets, tokens, cookies or payment data sent.

**Formal release:** G1/G2/G3/G8 = 4/10 accepted; G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK, NO-GO. The accepted DR and NEW LIVE canonical Worker URL OFF, no custom routes, separate physical serving/D1 identity, and prior anonymous four 404s remain accepted history; never rerun absent a specific code/route change.
