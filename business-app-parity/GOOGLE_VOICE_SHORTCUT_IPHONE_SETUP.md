# FIRE → Google Voice via iPhone Shortcuts (owner test, no deployment)

Google Voice's official iOS help says **Voice → Send a message** is available as
an action in Apple's Shortcuts app. Apple's official URL scheme lets the
existing FIRE PWA launch a personally installed shortcut using
`shortcuts://run-shortcut?name=FIRE%20Google%20Voice%20Text&input=text&text=...`.
This is not an SMS API, and FIRE never sends or claims delivery.

## Setup on the owner's own iPhone (one time)

1. Confirm **Google Voice** is installed and currently signed in to the FIRE
   business Google account; if using multiple Voice accounts, set the
   intended default in iOS. Do not use the phone's normal Messages action.
2. Open **Shortcuts** → **+** → name it **FIRE Google Voice Text** exactly.
   Check **Apps → Voice → Send a message** exists in the available actions.
3. Receive `Shortcut Input`, then add **Get Dictionary from Input**;
   Apple supports JSON text as dictionary input.
4. Add **Get Dictionary Value** with key `phone` and store that as a
   `FIRE Recipient` variable; get key `message` and store `FIRE Body`.
   The PWA supplies JSON `{"phone":"9185550102","message":"..."}`,
   properly encoded by the operating-system URL scheme.
5. If `FIRE Body` is empty, prompt for the text with **Ask for Input**
   rather than attempting to send an empty message.
6. Add a mandatory **Show Alert** reviewing the recipient and full message
   with a cancellation option. Do not continue if it displays a wrong
   number or incomplete body. Avoid enabling blind unattended send.
7. Configure the **Google Voice** action **Send a message**, not Apple's
   **Messages → Send Message**. If the Voice action on the installed iOS
   version allows dynamic variables, fill its message from `FIRE Body`
   and recipient from `FIRE Recipient`. On-device availability and exact
   action parameter behavior must be confirmed on this owner's phone.
   **If dynamic recipients are unsupported, STOP**, switch to a safe
   **Open App → Voice** action and paste the copied recipient/message
   manually. Do not implement speculative Voice URL schemes or force
   the user's personal SMS app.
8. On a consenting test phone (not a customer), open a draft FIRE customer
   record, select Text → **Use iPhone Shortcut**. Inspect the recipient,
   ensure Google Voice sends from FIRE's business number, and confirm the
   recipient sees that number; verify how the shortcut behaves on cancel.
   FIRE's **I sent** button must only be used AFTER a verified send.

## Fallback for any iPhone not yet configured

Every quick Text handoff also has **Copy number** + **Open Google Voice**.
The prepared-message composer has **Copy number**, **Copy message**, and
**Open Google Voice**. These manual controls must remain functional
regardless of Shortcut setup or failures.

## Privacy / rollout bounds

- No PWA `sms:` links and no personal-number iPhone Messages fallbacks.
- No Google account credentials, tokens, secret keys or external SMS service
  are added. Shortcut input is passed locally to iOS as user-initiated text.
- Owner stays in control of each send; never automatically spam customers,
  assume an app launch equals message delivery, or mark sent without approval.
- Treat Apple's Shortcut action and Google Voice account selection as
  physical-iPhone acceptance still pending, NOT a source-code CI pass.
- PR #56 remains **DRAFT**, not merged/deployed; existing QA photo vault,
  customer data, Cloudflare resources, Stripe, LIVE and Doomsday unchanged.

Official references:
- Google Voice iOS Siri & Shortcuts: https://support.google.com/voice/answer/9345389
- Apple run Shortcut URL: https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios
- Apple JSON Get Dictionary from Input: https://support.apple.com/guide/shortcuts/dictionaries-apd43b69f337/ios
