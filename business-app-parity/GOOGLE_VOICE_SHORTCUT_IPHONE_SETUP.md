# FIRE Google Voice iPhone handoff — real-device acceptance, Oct 28 2026

## Observed: native sending via iPhone Shortcuts is NOT reliable here

The FIRE owner built `FIRE Google Voice Text` with Apple's documented JSON text input, `phone` and `message` dictionary fields, and a confirmation prompt. Actual iPhone tests confirmed:
- Safari `shortcuts://run-shortcut` correctly launches the installed Shortcut.
- The test data `phone` and `message` each extract correctly from the JSON input.
- The Google Voice **Send a message** Shortcut action returned `Could Not Run Send a message — Couldn't send your message. Try again.` on two attempts.
- Contact permission was already Full Access; Siri app access was subsequently enabled; Google Voice was up-to-date; manual messaging inside Voice **worked**.
- An independently constructed, simple new Shortcut using a real saved personal contact and a fixed literal test message **also failed with the same error**. Thus the failed native action is **not attributable to FIRE JSON parsing, a self-text recipient or an unrecognized phone number alone**.
- Native Voice Shortcut sending is **NOT accepted**, and must not be offered as a reliable production FIRE text path without a distinct owner-observed successful controlled test.

## Follow-up: iPhone updated; a simplified Google Voice Shortcut sent a text

After installing the available iOS update and restarting, the owner reported **the independent simple Shortcut test worked**. The user did not explicitly finish the separate business-sender-ID verification step before moving to backup design. The full `FIRE Google Voice Text` Shortcut with iOS URL, JSON extraction, live customer number and live prepared body has **not yet been re-accepted after the update**. Do not prematurely imply that the current FIRE draft button automatically texts through Google Voice. The primary draft UI therefore retains its manual Copy/Open Voice fallback pending a dedicated device test.

## Personal-number emergency backups (user-requested)

- Ordinary **Text** and **Call** remain Google Voice **primary** actions.
- Explicit **Text (Backup)** and **Call (Backup)** use iPhone `sms:` / `tel:` ONLY after a direct user warning that the customer can see the owner's personal number.
- Each personal backup text automatically **copies the literal introduction** "Hi, this is First In Response Exteriors. We're using an alternate number today." followed by two newlines and the exact existing prepared message (when available).
- For quick Text (Backup) with no drafted message, the introduction alone is copied for manual editing.
- After a successful clipboard copy, `sms:` opens the chosen recipient; **the owner pastes, reviews, and taps Send**. Apple's documented web SMS URL DOES NOT support body auto-fill. A failed copy aborts navigation and alerts the owner not to send a blank or incomplete draft.
- Every template handled by the saved `MessageComposer` and the Schedule panel's explicit prewritten appointment / on-my-way drafts use the same prepared body for business and personal routes; only the personal route adds the alternate-number disclosure. Email-only and document template channels retain their intended behavior. No bulk auto-sends, invented delivery callback, or automatic message status.
- Apple's official URL format: https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html
- No real customer text or call was made during code changes; actual device acceptance remains pending.

## Safe current product decision

Draft PR #56, still **UNMERGED and NOT DEPLOYED**, removes the personal-number iPhone `sms:` links and provides **Copy number**, **Copy message** for prepared texts, and **Open Google Voice**. The owner sends from the Google Voice app or website and manually confirms any prepared message in FIRE only after real delivery. This doesn't fabricate Google Voice delivery acknowledgments or promise automation.

**Do not direct the owner to repeatedly test or rebuild their iPhone Shortcut.** The original `FIRE Google Voice Text` can remain saved for later troubleshooting, but it must not be used with customers in its current failing state. There is no supported direct Google Voice SMS API that FIRE can use to force the sender number. The customer-call path still requires a separate business-caller-ID solution and physical-iPhone acceptance.

Official reference: https://support.google.com/voice/answer/9345389

## Non-negotiable boundaries

- No automatic personal-number Messages / Phone app fallback.
- No silent sends, repeated retries, SMS blasts, real customer test targets or invented Google Voice deep links.
- Keep existing customer and prepared-message records, financial data and local photo ZIP intact.
- Keep QA Worker, QA D1, LIVE/Doomsday, Stripe and R2 unchanged absent separate exact approval.
