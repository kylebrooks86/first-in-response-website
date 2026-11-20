# FIRE — Real owner Stripe TEST Access policy detail: exact email allow rule (Nov 15, 2026)

**Provenance:** two owner-supplied authenticated Cloudflare Zero Trust Access policy detail screenshots, original uploaded files:
- `IMG_4334(1).png`, **369,097 bytes**, SHA-256 `bf3bb31d7eb5071650702d47e18bab480dc0e711a02ee52796d8c4753782c83a`.
- `IMG_4335(1).png`, **422,499 bytes**, SHA-256 `52c25e09f5d5dc3da35dffa74c80ad51a747ad37b514b9ae5950cd774c4a5d49`.
The original screenshots remain in the user's conversation. **GitHub stores evidence metadata, not screenshots.** The full owner login email and full policy UUID are visible in the original owner screenshot but deliberately MASKED here to avoid publishing private security-account selectors into the repository.

**Observed actual saved policy details** in Cloudflare's read-only policy overview:
- Name: **`FIRE Stripe TEST - Owner Only`**.
- Policy action: **Allow**.
- **Total rules: 1**, **Used by applications: 1**.
- Policy ID visible in screenshot, masked `938f89b2-…-74aa4554329c`.
- **Policy details > Include > Emails** has **one exact email address** `k***@firstinresponseexteriors.com` (original unmasked in screenshot). This is not an Allow Everyone rule, and is not an email-domain wildcard rule.
- Session duration: Same as application session timeout (app screenshot separately showed **1 week**).
- Created: November 1, 2026 03:37 PM (dashboard displayed); last updated the same displayed date/time. No change made in this inspection.
- Related app list in policy modal shows exactly one application row `fire-stripe-test-20261101` (truncated by viewport).

**Critical interpretation boundaries:**
1. The **underlying reusable Allow policy** has an actual exact-email Include rule. This **corrects and resolves** the previous uncertainty about the named “Owner Only” policy's actual Include selector. The separate Access application editor's Preview **`SOURCES: All authenticated users`** was NOT the actual saved policy's Include condition.
2. The full policy modal displays the Include condition. It does not establish effective **destination binding/enforcement** on the Stripe TEST Worker, nor a successful owner login, nonowner denial, bypass or service token flow. Previous TEST Access application editor simultaneously showed a Worker scope selector and Preview **`DESTINATIONS: No destinations assigned`**, which remains an **unresolved discrepancy** until inspecting the actual Worker's Access status. This file must not promote any Gate based merely on an unbound policy.
3. Signed Stripe webhooks are machine-originated; an effective exact-human-email Access gate on the webhook path may prevent delivery unless a separate, explicitly reviewed machine-to-machine strategy is configured. The policy itself is not an authenticated webhook delivery receipt. Earlier connected Stripe sandbox GET had dedicated TEST webhook **enabled for six required event types**, but no events were returned in the recent event list. Gate9 remains OPEN.
4. Neither DARK Worker DR nor NEW LIVE was touched. Their production and preview URLs OFF, no selected-Worker custom routes, exact immutable serving versions/isolated physical D1 identifiers, and four anonymous 404 checks are accepted. Do not repeat them.
5. **Suggested next DIFFERENT read-only check:** From an existing authenticated Cloudflare session, exit this modal with **X**, leave any unsaved Access application editor via **Cancel** (not Save/Delete), then navigate **Workers & Pages > fire-stripe-test-20261101 > Access** to inspect whether worker-level Access is truly attached and its effective traffic scope; if Access tab differs, view that Worker's existing Settings > Domains & Routes Access indicators without toggling. No changes to TEST webhook or worker routes, nor to DARK workers. Cloudflare docs (Nov 2026) describe Workers > Access as the worker-level protection location.

**Release state:** Formally G1/G2/G3/G8 accepted = **4/10**; G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK, NO-GO. This is read-only documentation; no Cloudflare Access edits, policy tester, provider logins, Stripe events, D1/SQL, Stripe/R2 plan, paid service, worker deployment, DNS, merge or production cutover.
