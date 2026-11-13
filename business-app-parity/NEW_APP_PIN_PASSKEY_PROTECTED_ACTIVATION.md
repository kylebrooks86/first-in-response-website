# FIRE NEW app — four-digit PIN or device passkey activation, 2026-11-13

**This document describes source-ready features, not deployed settings.** GitHub PR240 must remain DRAFT until exact hosted security approval and provider setup. The user's older ChatGPT Sites application is not targeted. The QA app is the functional/visual master.

## Owner experience after verified setup

- **Device passkey**: Cloudflare Access (first-party WebAuthn provider, announced Nov 6, 2026) offers passkey sign-in using Face ID, fingerprint/Touch ID or another device unlock. FIRE itself never reads biometric data; it validates the signed Access assertion and issues a private app session.
- **Four-digit PIN**: Same four numeric digits can be used on the owner's devices and across the NEW QA, STAGING, DR and NEW LIVE apps, but each environment must have its **own** keyed PIN hash and independent pepper. The PIN is an alternative app unlock **after Cloudflare Access has verified owner identity**. It is not a public, PIN-only login.
- Existing app sessions, owner share links and core UI continue to use signed HttpOnly/Secure/SameSite=Strict app cookies. A newly configured quick sign-in issues a **v2** cookie; the old **v1** cookie is refused in quick mode. STAGING old 30-day cookie becomes a 12-hour session under quick mode. No app or device session is transferred to a different environment.

## Exact prerequisites / NO auto activation

1. On the correct Cloudflare account, enable **Zero Trust → Integrations → Identity providers → Passkeys**, if supported. Enroll the approved owner with the existing login before relying on passkey alone. Do not make any untrusted group, email-domain or public bypass rule.
2. For **each NEW app origin**, create an Access self-hosted application protecting **the owner login routes** `/login` **and** `/api/auth/login` with the owner's exact identity and an associated application audience. **Do not block the whole Worker without separate public share-link compatibility review.** The same app also serves public estimate/invoice/customer-view links that must not require the internal owner login. Protecting all Worker traffic without exceptions can break those links. Verify the effective Access policy/audience for both login paths, and keep the rest of the app protected by v2 FIRE sessions and existing public share-token checks.
3. Confirm the actual full provider account domain `<team>.cloudflareaccess.com` and EACH protected app's exact `aud` (audience tag), including whether both protected login paths use one audience. Confirm the effective Worker `Cf-Access-Jwt-Assertion` forwarding, issuer and authorized email. Cloudflare Access email OTP alone can produce an authenticated identity; the biometric experience requires the owner to select/enroll a passkey in Access. Do not claim to inspect fingerprints or detect Face ID inside app JavaScript.
4. Per Worker, bind these nonsecret runtime variables: `FIRE_QUICK_AUTH_MODE=passkey-or-pin-v1`, `FIRE_ACCESS_TEAM_DOMAIN=<actual-team.cloudflareaccess.com>`, `FIRE_ACCESS_AUDIENCE=<actual Access application audience>` and `FIRE_ACCESS_OWNER_EMAIL=<approved owner email>`. Never invent or copy application audiences or physical Worker identities.
5. Privately provision separate owner-only secrets using the exact per-environment names below. The PIN hash must be `lowercase hex HMAC-SHA256(key=privatePepper, message=UTF8(fourDigits))`; the pepper must be 32+ random characters generated for that environment, unrelated to the others, never in public code, git, chat, source test output, public logs or front-end variables. The PIN itself must never be sent in chat.
6. Verify code/build source SHA, active Worker version, physical D1, R2 and auth bindings, existing protected route behavior and old serving rollback. Only then request a separate exact-source owner-approved hosted update. Run **targeted** protected-login passkey, PIN good/bad/lockout, cross-customer and public share-link tests. Do not redo unrelated accepted owner iPhone/full-app suites. Existing old login remains until this mode is explicitly enabled and tested.

| NEW app environment | PIN hash secret | PIN pepper secret |
| --- | --- | --- |
| QA master | `FIRE_QA_PIN_HASH` | `FIRE_QA_PIN_PEPPER` |
| Independent STAGING / Doomsday | `FIRE_PIN_HASH` | `FIRE_PIN_PEPPER` |
| NEW DR | `FIRE_DR_PIN_HASH` | `FIRE_DR_PIN_PEPPER` |
| NEW LIVE | `FIRE_NEW_LIVE_PIN_HASH` | `FIRE_NEW_LIVE_PIN_PEPPER` |

**Fail closed:** If mode is enabled without the correct Access JWT, pinned issuer, audience, owner email, valid RS256 signature, or private PIN secrets, the login refuses access. Failed PIN attempts remain D1 rate limited. Client-side biometrics alone, a spoofed `cf-access-jwt-assertion` header, and an old signed v1 session can never authorize the new quick login.

## Provider references

- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/passkeys/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validate-jwt/

**Deployment and gate status:** In-source only; no Cloudflare/Stripe write, no PIN chosen, no Access policy changed, no real biometrics enrolled in this PR. Gates 1,2,3,8 previously accepted; 4,5,6,7,9,10 remain OPEN, LIVE NO-GO.
