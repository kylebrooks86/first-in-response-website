# Isolated full Business App mobile test — zero-new-charge preflight (October 16)

Owner authorization: **YES, conditional**, to use the existing Cloudflare account for a **new**, strictly isolated FIRE test environment **only if there is $0 new cost** and **no modifications to existing applications, databases, photo storage, authentication, DNS or customer records**. This is not permission to upgrade billing, activate a paid subscription, apply migrations remotely, deploy to an existing Worker, reuse an existing D1/R2 resource, or process real Stripe payments. The owner already completed the separate Acer/Edge encrypted synthetic recovery milestone; do not repeat that test.

## Tested checkpoint

Branch `work/fire-business-app-parity-2026-10-08` commit `f8724e1435cc481be52c693533df0ff8061affa6`, six out of six CI jobs successful:
https://github.com/kylebrooks86/first-in-response-website/actions/runs/38969158673

The code now contains **read-only** `check_isolated_cloudflare_free_preflight.py` with negative-test suite. Only a sanitized D1 count is returned; no database names, UUIDs, tokens or secrets. It uses only `wrangler d1 list --json`. It does NOT prove Cloudflare account plan, free status, CPU feasibility, R2 subscription, Worker name availability, user authentication, source routing, or a working full-app URL. It explicitly returns `safeToDeploy: false` and zero resources created.

On the owner's **already authenticated Acer**, the bounded next action is:

```powershell
git -C "$HOME\first-in-response-website" pull --ff-only
if ($LASTEXITCODE -eq 0) { py -3 "$HOME\first-in-response-website\business-app-parity\check_isolated_cloudflare_free_preflight.py" --capture }
```

If either fails, stop and use a screenshot showing only sanitized output, not a token dump.

## Provisional names — DO NOT CREATE until all checks pass

- New Worker: `fire-fullapp-qa-20261016`
- New D1: `fire-fullapp-qa-db-20261016`
- Potential new Standard R2 photo bucket: `fire-fullapp-qa-photos-20261016` (do not activate R2 billing or create a bucket just to test)
- Synthetic data **only**; one owner-authenticated QA environment; separate install origin from LIVE, refund staging, synthetic recovery demo, and independent Doomsday.

Current published Workers Free limit: 100,000 requests/day, 10 ms CPU per invocation (not guaranteed sufficient for vinext server render). D1 Free: maximum ten databases and 5 GB total account storage. Official documentation:
https://developers.cloudflare.com/workers/platform/limits/
https://developers.cloudflare.com/d1/platform/limits/

R2 Standard has monthly free allowance, but an R2 subscription **may require activating a billing/checkout flow**, and excess usage is billed. It does **not** satisfy $0-by-construction until existing account entitlement, billing configuration and limits are verified and a no-charge safeguard is acceptable to owner. Do not activate it, add a card or purchase anything:
https://developers.cloudflare.com/r2/get-started/
https://developers.cloudflare.com/r2/pricing/

## Deployment blockers independent of D1 count

1. Owner's **actual Workers account plan**, current project count, D1 and storage consumption, and any R2/billing subscription must be inspected in Cloudflare Dashboard. A passing D1 count does not establish $0.
2. Independently verify exact noncollision for new Worker and separate binding identities. Never bind `fire-app-independent-staging` or `fire-app-staging-db` or any ChatGPT Sites resource.
3. Reconcile **authentication**: coordinated LIVE candidate uses `requireChatGPTUser` and ChatGPT gateway. A direct Cloudflare Worker deployment does NOT automatically have that identity. Use a deliberately reviewed QA auth adapter with safe secret handling; never copy production credentials or publish an owner-only dashboard publicly without auth.
4. Confirm D1-only app startup/capabilities and photo routes' fail-closed behavior if R2 cannot be used safely. A worker with disabled photos cannot pass Gate 7 full hosted-photo acceptance. Never misrepresent test scope.
5. Confirm Workers Free 10 ms CPU can serve the actual built vinext app with synthetic screens. If it cannot, stop rather than auto-upgrade.
6. Review a **single immutable source/build package** from successful CI, revalidate `DEVICE_REVIEW_RECEIPT.json` before publication, restrict to separate test URL and synthetic data, and obtain narrow owner consent on precise first deployment actions if anything exceeds the existing conditional authorization. Do not run the legacy DR deploy script; it is hard-pinned to the existing Doomsday Worker and database and contains migration/deploy commands.

**Status:** Owner approved the conditional plan. No isolated Worker, D1, R2, domain, or app deployment created; no cost/account plan confirmed. Official release readiness stays **3/10 (30%)** until full candidate physical iPhone/iPad and other gates are accepted.
