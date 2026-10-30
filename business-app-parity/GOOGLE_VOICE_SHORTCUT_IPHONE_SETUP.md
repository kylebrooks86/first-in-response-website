# FIRE Google Voice handoffs — current candidate, October 28, 2026

## New owner-verified texting evidence

The existing `FIRE Google Voice Text` Shortcut now receives Shortcut Input as **Text**, parses JSON containing `phone` and `message`, uses **Phone Number** for the recipient variable and **Text** for the message variable, and retains its owner confirmation prompt before sending.

The owner verified both clipboard JSON input and a Safari `input=text&text=` launch containing encoded JSON. Tahlor received the exact `FIRE Google Voice Direct Test 5` message from the FIRE Google Voice business number. This supersedes the earlier blocked/intermittent native-texting result for this controlled configuration. Do not rebuild, rename, or repeat the completed setup. This evidence does not establish delivery from the new FIRE candidate, installed Home Screen dispatch, or general provider reliability.

Earlier attempts received `Could Not Run Send a message` even with a fixed contact/message; an iOS update worked once before another failure. Those historical failures must not be blamed on FIRE JSON extraction, which had already worked. The new controlled direct-input success is the basis for this targeted candidate.

## Direct text behavior in draft PR #56 — NOT deployed

- The five existing primary **Text** locations retain their existing dialog. A quick action with no prepared body provides a message field; blank messages cannot launch. Saved/prepared text is preserved exactly and remains selectable.
- **Text via Google Voice** passes `encodeURIComponent(JSON.stringify({phone: normalizedRecipient, message: exactBody}))` to `shortcuts://run-shortcut?name=FIRE%20Google%20Voice%20Text&input=text&text=...`. No clipboard, callbacks or delivery API.
- In MessageComposer, the original **Text** preparation first saves and verifies the existing `text_prepared` receipt. A separate **Text** action in that saved-message handoff launches the Shortcut using the saved body. No launch occurs after an asynchronous save without a fresh user tap. Failed/mismatched preparation cannot offer the direct saved-message handoff.
- Approve the recipient/body inside the existing Shortcut. FIRE records no sent status, schedule transition or review clock just because the link opened, the app regained focus or a timer elapsed. The separate **I sent the prepared message** action and exact matching receipt remain mandatory.
- Same-attempt duplicate callbacks stay locked after requesting a handoff. **Not sent — allow retry** requires a duplicate-send warning and only resets the control; it does not launch again. Check Google Voice before a deliberate retry, including after reopening the dialog.
- iPhone/iPad detection is a capability hint, not proof that the Shortcut or Voice is installed. Other devices keep manual Copy/Open Voice options. Synchronous launch errors are explained. Missing Shortcuts, native cancellation and provider failure cannot be reliably observed by the webpage: status stays **unconfirmed**, the full original message remains available, and no automatic retry or personal-number fallback runs.
- FIRE conservatively refuses URLs over **8,000 encoded characters**. This is an application transport guard, not a documented Apple limit or a delivery guarantee. Unicode/JSON overhead counts. No truncation, chunking or silent body replacement: copy the full message into Voice manually instead.

Apple reference: https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios

## Calling and manual/personal backups preserved

The owner verified the existing calling Shortcut, then named `Call 4` and now named `FIRE Google Voice Call`, with clipboard input and FIRE business caller ID. The current calling integration passes the validated selected number with `shortcuts://run-shortcut?name=FIRE%20Google%20Voice%20Call&input=text&text=...`. Its direct FIRE route still needs physical-iPhone acceptance. No calling behavior is changed by the direct-text candidate.

**Copy number / Copy message / Open Google Voice** remain available. Personal **Text (Backup)** / **Call (Backup)** remain separate and explicitly warned. Backup texts first copy the alternate-number introduction plus the exact prepared message, then open Messages for owner paste/review/send. Clipboard failure aborts that backup. Saved templates, pending drafts, confirmation/cancellation audit records, and all financial/signature history remain intact.

## Focused physical-iPhone acceptance — after separate exact-source QA approval

1. Verify the approved QA commit and use a QA contact pointing only to an owner-controlled or consenting test phone. Keep unrelated content on the clipboard. Do not alter the working Shortcuts.
2. In Safari, open a quick Text panel, enter a multiline message containing a link, quotes, `+` and `&`, and launch the direct action. Verify the exact recipient/body in the Shortcut; cancel its confirmation first. No recipient message and no FIRE sent record should result. Return and use the explicit unsent retry only after checking Voice.
3. Approve one controlled send; verify exact receipt and FIRE business sender on the consenting phone. FIRE must remain unconfirmed until explicit owner confirmation. Opening or cancelling must not trigger personal Messages.
4. Repeat from the installed Home Screen app with a different selected test recipient and a saved template/prepared message. Verify exact saved body/recipient, unchanged pending audit on cancellation/failure, and the existing explicit confirmation after actual sending.
5. Verify a deliberately oversized draft stays complete and offers manual Voice, and cancel the warned personal backup. Preserve the existing calling acceptance check separately.

No automated test places calls or texts. No QA/LIVE/Doomsday deployment, hosted migration, Stripe/database setting change, customer communication, or photo/backup deletion is authorized. Formal production acceptance remains **3/10 (30%)**. Offline support remains limited; full Estimates, Schedule and Follow-ups require the server.
