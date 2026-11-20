# FIRE — Real Acer anonymous DARK Worker URL reachability (owner screenshot, November 15, 2026)

**Evidence class:** Real owner-supplied Acer Windows PowerShell screenshot of four anonymous HTTPS requests, not synthetic local CI, not a provider-authenticated routing inventory.

**Capture:** The owner supplied original conversation image `IMG_323C143C-8E48-4BF0-B694-A8A2E701EC6B.jpeg`, 403,498 bytes. Original uploaded image **SHA-256 `bbecab0bd1528d709fdbaedcf838c6e47280bd5a0a8d4634a98d7300bb786d2a`** computed from the supplied bytes. The original image remains in the owner's chat, NOT copied to GitHub, and is not asserted to be a Cloudflare provider-attested report. Clock visible in owner screenshot is Windows PowerShell; no device timestamp is independently proved. Date supplied in ongoing owner session is November 15, 2026.

**Exact read-only invocation displayed on screenshot:**

```powershell
$targets = @(
  "https://fire-fullapp-dr.kyle-bfc.workers.dev/"
  "https://fire-fullapp-dr.kyle-bfc.workers.dev/api/customers"
  "https://fire-fullapp-new-live.kyle-bfc.workers.dev/"
  "https://fire-fullapp-new-live.kyle-bfc.workers.dev/api/customers"
)
foreach ($url in $targets) {
  $status = curl.exe -sS --max-time 12 --max-redirs 0 -o NUL -w "%{http_code}" $url
  Write-Host "$url  HTTP=$status"
}
```

**Observed owner PowerShell response:** All four requests were **`HTTP=404`**, matching the exact host and path pairs above.

| Environment | Anonymous target | Observed status |
| --- | --- | --- |
| DR | `https://fire-fullapp-dr.kyle-bfc.workers.dev/` | HTTP 404 |
| DR | `https://fire-fullapp-dr.kyle-bfc.workers.dev/api/customers` | HTTP 404 |
| NEW LIVE | `https://fire-fullapp-new-live.kyle-bfc.workers.dev/` | HTTP 404 |
| NEW LIVE | `https://fire-fullapp-new-live.kyle-bfc.workers.dev/api/customers` | HTTP 404 |

**What this newly supports:** Both selected DARK Workers' canonical `workers.dev` hostnames returned neither public app content nor customer API data to these four anonymous **GET** requests at this observation. This independently supplements real owner Cloudflare dashboard screenshots previously accepted showing **both selected Workers** Production workers.dev OFF, Preview OFF and no listed Worker custom domains/routes, plus separately accepted 100%-traffic serving version/D1 binding reads. A 404 is a result, **not** proof of the party generating it: it might be Cloudflare's unrouted-host response or an application-generated 404. Response bodies and authenticated source identity were not captured. Do not assert every possible preview/custom domain, account-wide zone route, Access policy, owner-versus-nonowner denial or active app parity was proven. Neither HTTP 404 alone nor absence of traffic closes Gate4/G6.

**Historical error shown ABOVE the new four requests:** `FIRE EXISTING WRANGLER READ-ONLY STOP: no verified proof` was the **previously documented stopped existing-session CLI helper**, NOT a failure of the new four CURL requests. Do not rerun that stopped helper, repeat Wrangler auth, or reattempt first-creation.

**Writes and scope:** These were ordinary anonymous no-redirect GETs with body suppressed; no Cloudflare login, Worker deploy, routing, D1/SQL, Access, Stripe, Git merge, DNS or customer-data write. No paid Cloudflare/R2. No previous accepted owner Acer screenshot or provider identity readback is being re-requested. Formal **4/10 release gates accepted (G1/G2/G3/G8)**; G4/G5/G6/G7/G9/G10 remain OPEN, NEW LIVE remains DARK NO-GO. Next Gate4/G6 evidence must address a **different** missing scope: authenticated provider policy/account-wide route inventory, or hosted owner/nonowner denial on a safely reachable authorized QA/STAGING target. Do not expose DARK Workers or turn on any workers.dev/preview route to test denial.
