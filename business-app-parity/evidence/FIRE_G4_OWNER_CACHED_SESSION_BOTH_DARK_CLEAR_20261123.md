# FIRE G4 owner Acer — cached-session DARK-only read-only success (November 23, 2026)

## Evidence scope and ownership
Three ORIGINAL private owner Acer JPEGs received in conversation. Public GitHub stores only their identifiers and sanitized observed facts, not images, sessions, URLs, tokens or credentials. SHA-256:
- `IMG_EB3AF5C5-16F3-4694-B8BD-AE0D91983B25.jpeg`: `658a5bde6202cbfcecb3672282151fce6faf0f5ab89537fbe7ebbcd9c5f00433` (316275 bytes, 1080×1440); shows the owner Windows read-only invocation and DR result.
- `IMG_50EE5214-86FD-4C0F-977C-75B30E0E5794.jpeg`: `0aeeb9141d02f7ecf15811d5be547df18958b9f8ea1d725e7a8ca03379b5fcdd` (315863 bytes, 1080×1440); shows NEW LIVE inventory.
- `IMG_A5C12B64-22EC-4654-9B83-13010B3FFE56.jpeg`: `cc59f7afa795dfe5b0333be66960f4c42336fa5d53a34d20b71ccd31ee99337f` (264101 bytes, 1080×1440); shows end-of-receipt summary.

Owner invoked the existing PR282 `owner_g4_g5_existing_session_readonly.mjs` with `--capture-dark-existing-session` using already-available Wrangler authentication (not a new browser login). This is **distinct from the earlier November 23 12:41 CST generic STOP on an older local checkout**. This receipt is a real, visible owner-local Cloudflare provider API readback; no provider mutation.

## Exact bounded result supported by screenshot
- `accountWideDarkExposure.result: FIRE_BOTH_DARK_EXPOSURE_INVENTORY_CLEAR`; the two targets are `fire-fullapp-dr` and `fire-fullapp-new-live`.
- Each target reports `FIRE_DARK_EXPOSURE_INVENTORY_CLEAR`, `workersDevEnabled:false`, `workersDevPreviewEnabled:false`, `targetCustomDomains:0`, `targetZoneRoutes:0`, `zonesInspected:0`, `accountCustomDomainsInspected:0`, `completeInventoryFromSuppliedEvidence:true`, `publicEndpointsAbsentInSuppliedEvidence:true`, `providerReadbackVerified:true`, `directReadOnlyCloudflareApi:true`, `providerDataMutated:false`.
- The final wrapper reports `accountWideInventoryCaptured:true`, `darkPublicEndpointsAbsent:true`, `stagingJournalNotQueried:true`, `providerContacted:true`, `providerWrites:false`, `loginAttempted:false`, `tokenStored:false`, `tokenDisplayed:false`, `gate4Accepted:false`, `gate5Accepted:false`, `releaseAuthorized:false`, `newLivePublic:false`.
- These fields are evidence for complete paginated Worker subdomain/preview, account worker-domain, ordinary/internal-zone and corresponding route lists **in the scoped Cloudflare account returned by those provider GETs**. Zero zones inspected means the complete account-zone listings returned empty; it is not a claim that routes in arbitrary external accounts were enumerated.
- Private auth values and customer data are not present in the saved result. The owner PowerShell prompt returned normally.

## Correct formal interpretation: no double credit
The original provider-backed **both-DARK absence subproof had ALREADY been accepted on November 22**: [FIRE_G4_OWNER_BOTH_DARK_ACCOUNT_INGRESS_API_CLEAR_20261122.md](FIRE_G4_OWNER_BOTH_DARK_ACCOUNT_INGRESS_API_CLEAR_20261122.md), including exact scoped review. This new result proves that the separately added existing-Wrangler-session G4-only fallback works after the November 23 generic STOP. It **does not earn a second original 95-item release checkbox or complete G4-05**; do not repeat either successful DARK scan.

Physical hosted source bytes, Access policy applicability, effective authenticated nonowner/cross-customer denial, the QA/STAGING/Pages ingress map, and STAGING serving-version parity remain unproved by these images. STAGING G5 prior read-only migration fingerprint `b36bf9d7e623f31079f31de0adc73c70b6895ad37122fbc9b6d3efff2737adfb` (22/25, `0022`–`0024` pending) is preserved and **was not rerun**. The already-spent one-time STAGING inactive upload consent remains consumed: **NO RETRY** and do not reset its lock.

**Original release acceptance remains 51/95, 44 open; G1/G2/G3/G8 accepted (4/10), G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK / NO-GO, first real Job #0001 unused.** No Git merge, deployment, Cloudflare/Access/Worker/route/SQL/D1/Stripe/payment/customer/photo change, or paid R2/Cloudflare service authorized or performed in this evidence capture.
