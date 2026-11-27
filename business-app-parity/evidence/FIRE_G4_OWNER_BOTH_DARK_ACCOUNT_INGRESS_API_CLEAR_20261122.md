# FIRE G4 — Owner's actual Cloudflare account-wide DARK ingress readback, 2026-11-22

## Status

**[x] Physical read-only provider inventory for BOTH DR and NEW LIVE DARK Workers captured and reviewed.** This retires the prior missing account-wide DARK inventory evidence substep only.

**[ ] Original numbered G4-05 NOT YET ACCEPTED.** That is a compound gate requiring routes, hostname/preview aliases, externally reachable endpoints and applicable Cloudflare Access scope across the target app/environment; hosted byte parity, effective Access and nonowner denial are separate unresolved evidence. **[ ] Gate 4 not formally accepted.** No publication, deployment or authorization to change Cloudflare.

## Owner-source custody

- Owner's original Acer PowerShell photograph in Nov 22 conversation, locally named `IMG_B1DFF754-93CA-4008-9165-0C631EAE9233.jpeg`, **305,549 bytes, SHA-256 `072b197fc8118bf17dbd499b51a419a9c69a745a85ba02e2349c5549e13d506c`**. Original image is in the owner's conversation; **not uploaded to public GitHub**.
- 2026-11-22 about 13:36–13:45 CST after owner's private 7-day `FIRE G4 Read Only` token creation. Token value never supplied to ChatGPT or GitHub. Owner's Windows interactive shell returned to normal `PS C:\Users\Kyleb\FIRE-G4-DARK-GET-ONLY-20261118\FIRE-G4-G5-ReadOnly-1122>` prompt, indicating the command completed.
- Source from existing integrated unmerged draft PR [#282](https://github.com/kylebrooks86/first-in-response-website/pull/282), `business-app-parity/owner_current_dark_exposure_readonly.mjs`, pinned checker update based on exact reviewed source/test commit [`28427d9338da...`](https://github.com/kylebrooks86/first-in-response-website/commit/28427d9338da320a02783778adf33f791103eec4). The fix for optional absent Cloudflare `result_info.total_pages` is [`daf14ba4`](https://github.com/kylebrooks86/first-in-response-website/commit/daf14ba4b553f0453383f1e4cb04093ab2888c6e). The focused offline DR/NEW LIVE gate4 workflow [#45062273865](https://github.com/kylebrooks86/first-in-response-website/actions/runs/45062273865) completed **SUCCESS** at the fixed tested SHA. Do not extrapolate a full 27-workflow verdict without separate confirmation.

## Real sanitized receipt, exact scope

The owner's PowerShell block performed **only Cloudflare read-only GETs** and first called `--capture dr`; if its exit status was 0 or 2, it called `--capture new-live`. The final owner screenshot shows **two consecutive JSON result objects** and the normal shell prompt; both contain:

- `completeInventoryFromSuppliedEvidence: true`
- `publicEndpointsAbsentInSuppliedEvidence: true`
- `providerReadbackVerified: true`
- `accessPolicyProviderVerified: false`
- `hostedSourceBytesVerified: false`
- `hostedNonownerDenialVerified: false`
- `gate4Accepted: false`, `productionReady: false`, `directReadOnlyCloudflareApi: true`, `providerDataMutated: false`

The fully readable **NEW LIVE** object is:

```json
{
  "result": "FIRE_DARK_EXPOSURE_INVENTORY_CLEAR",
  "target": "new-live",
  "worker": "fire-fullapp-new-live",
  "workersDevEnabled": false,
  "workersDevPreviewEnabled": false,
  "targetCustomDomains": 0,
  "targetZoneRoutes": 0,
  "zonesInspected": 0,
  "accountCustomDomainsInspected": 0,
  "completeInventoryFromSuppliedEvidence": true,
  "publicEndpointsAbsentInSuppliedEvidence": true,
  "providerReadbackVerified": true,
  "accessPolicyProviderVerified": false,
  "hostedSourceBytesVerified": false,
  "hostedNonownerDenialVerified": false,
  "gate4Accepted": false,
  "productionReady": false,
  "directReadOnlyCloudflareApi": true,
  "providerDataMutated": false
}
```

The **DR object's beginning is cropped off** at the top of this photograph; avoid inventing its unpictured target-route or zone-count fields. The visible trailing DR receipt unequivocally reports the three successful provider readback/complete-inventory/absence booleans listed above. The command's gated control flow and subsequent NEW LIVE object corroborate successful completion in order.

**Important 0-zone interpretation:** The tool independently queried ordinary AND `type=internal` zones within the pinned FIRE Cloudflare account. If zero zones are listed, there is no zone Worker-route table to inspect within that account. This corroborates previously accepted authenticated owner `Domains > No data available` screenshots, not a substitute for all other ingress/Access checks. The script separately queried the complete account Worker Domains list and each target's production/preview workers.dev toggle.

## What has now advanced

- **[x] G4-05 missing DR+NEW LIVE account-wide DARK Cloudflare API inventory subproof physically captured and closed** (not merely offline CI or an account UI screenshot). No need to ask the owner to rerun this exact GET inventory.
- **[x] No domain attachments or worker-zone routes reported for NEW LIVE; no public DARK endpoints in both scoped inventories**, as attested by actual provider readback. This validates that **both specifically targeted DARK Workers remain non-public according to the checked provider surfaces at capture time**.
- **[ ] Full G4-05 stays OPEN**: per-authoritative 95-row checklist, additional hostnames/Pages preview/Access scope and externally observed denial for the wider QA/STAGING/Stripe/website inventory still require reconciliation with already accepted records; these are not demonstrated by this two-DARK-Worker API report alone.
- **[ ] G4-06 (effective Access/owner/nonowner denial), G4-01/02/04/07/10/11, G5/6/7/9/10 formal gates remain unaccepted** unless separately accepted records prove a specific item. Do not repeat previously accepted G5 STAGING 22/25 journal, QA/iPhone, account-zone screenshot, Stripe or Worker screenshots.

## Safety and release tracking

- Read-only operations only. No Cloudflare login retries, Worker/route/Access/D1/SQL writes, migration, merge, deployment, paid subscription/R2, Stripe/payment changes, public publication, or customer/photo mutations. Token is private and expires 2026-11-29; owner can revoke after all authorized use.
- **Original release tally remains 51/95 accepted (44 open), 4/10 full gates accepted (G1/G2/G3/G8).** G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK/NO-GO; initial real Job #0001 unissued.
