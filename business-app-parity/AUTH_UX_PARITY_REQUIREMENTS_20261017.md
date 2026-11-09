# FIRE owner sign-in and mobile interaction — release acceptance requirement (2026-10-17)

Owner requirement: **Do not require entering a full password to open FIRE for ordinary daily use.** If manual unlock is needed, the visible owner unlock must be a short **four-digit numeric PIN**, not a passphrase.

## Non-negotiable experience

- iPhone, iPad, and Acer can have responsive controls, but all FIRE versions (LIVE, staging, independent Doomsday, isolated QA) must expose the **same business actions and workflows**. Only environment-specific safety barriers / credentials may differ.
- A trusted device should preserve a valid owner session across ordinary browser/app closes and restarts. On a trusted device the default unlock should be Face ID/Touch ID/appropriate device passkey when supported, with a clearly labeled **4-digit PIN** fallback for device unlock.
- Do not ask for a long password repeatedly during routine openings, navigation or use; never expose a secret in a URL, browser local storage, or screen screenshot.
- Never use an unauthenticated shortcut to bypass cloud authorization. A 4-digit PIN by itself is **not sufficient as an unrestricted public-web credential**: pair quick unlock with device-bound cryptographic credentials/session protection, plus throttling, lockout and secure recovery/enrollment.
- First-time device enrollment and recovery may require a separate strongly verified owner step; explain this plainly before requesting it. Existing synthetic QA credentials are intentionally separate from LIVE/Doomsday, and must NOT be changed automatically.
- Lost, stolen or replaced devices require revocation support. A signed-out session must not silently re-authenticate; remember-me persistence never overrides deliberate sign-out.
- **No changing or migrating LIVE/QA/staging/Doomsday databases, no resetting device vaults, and no production deployment** without separate authorization. Any passkey / session storage schema proposal needs a dedicated review and synthetic tests.

## Acceptance before calling sign-in finished

1. On iPhone and iPad, close Safari, reopen the FIRE PWA/site, and verify trusted-device access without long passphrase re-entry; biometric/passkey unlock when supported and four-digit PIN fallback.
2. On Acer, verify the same business workflow with Windows Hello/passkey or device-bound four-digit unlock; desktop may lay out controls differently.
3. Verify 4-digit numeric keypad, masked PIN, failed-attempt throttling/lockout, deliberate sign-out, recovery and locked-out behavior; never unlock records after failed authorization.
4. Verify each deployed identity is distinct but user flows parity-match. Real-device tests must demonstrate it; source parity alone is insufficient.
5. Test the existing independent Doomsday four-digit PIN as a separate current feature; do **not** assume its PIN-only server authentication satisfies the device-bound public-web requirement. Current hosted isolated QA still uses a long synthetic QA passphrase with 12-hour cookie; the final owner UX requirement is **not implemented** by this document.
6. Do not mark any release gate complete solely because this requirement was documented.

## Separate accepted mobile payment UI change

The former full-width 'Record payments' phone CTA consumed excessive vertical space. Keep the same actual Payments navigation and an accessible name, but expose a compact **$** action in the top toolbar at all screen sizes, replacing the desktop orange-dot/text shortcut too, with only responsive sizing and no overlap on small devices. No button directly charges/collects funds.
