/** Source-only regression contract: business primary and explicitly warned personal emergency backups. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui=readFileSync("app/dashboard.tsx","utf8");
const action=readFileSync("components/google-voice-text-action.tsx","utf8");
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;console.log("PASS: "+label);}
check(!/sms:/i.test(ui),"No personal-number sms: route remains in main FIRE dashboard");
check((ui.match(/<GoogleVoiceTextAction\\b/g)||[]).length===2,"Two contextual short-text actions still use direct validated Google Voice handoff");
for(const location of [
 'estimate.phone&&<MessageComposer customer={messageCustomer} estimate={estimate} initialTemplate="custom" triggerLabel="Text"',
 'contactPhone&&<MessageComposer customer={selected} initialTemplate="custom" triggerLabel="Text"',
 'customer.phone&&<MessageComposer customer={customer} estimate={estimate} initialTemplate="custom" triggerLabel="Text"'
])check(ui.includes(location),"Primary customer, estimate and follow-up Text offers saved templates/custom text and manual Voice preparation: "+location);
check((ui.match(/<GoogleVoiceCallAction\b/g)||[]).length===5,"All five direct customer Call buttons use business Google Voice handoff");
check((ui.match(/<PersonalPhoneBackupAction\b/g)||[]).length===11,"Personal backup options exist on five call, five text and prepared-message actions");
check(action.includes("window.confirm(warning)") && action.includes("PERSONAL cellphone number") && action.includes("Phone app"),"Personal backups warn before exposing the owner number");
check(action.includes('"sms:" : "tel:"') && !/sms:|tel:/i.test(ui),"Personal iPhone routing is isolated to warned backup action, not primary app buttons");
check(ui.includes('message={preparedMessage.body}') && action.includes("navigator.clipboard.writeText(personalBackupTextBody(message))"),"Prepared message backup reuses saved template with alternate-number introduction via clipboard");
check(action.includes("Hi, this is First In Response Exteriors. We\'re using an alternate number today."),"All personal backup SMS texts begin with the correct alternate-number disclosure");
check(action.includes("PERSONAL_BACKUP_TEXT_INTRO + \"\\n\\n\" + original"),"Alternate-number notice prepends without editing saved message template");
check(ui.includes("message={contactDraft?.jobId===job.id?contactDraft.text:undefined}"),"Schedule reminders and on-my-way drafts flow into both text actions");
check(ui.includes('if(!await log("text_prepared"))return')&&ui.includes("setMessageStatus(\"Prepared for Google Voice."),"Message composer preserves saved prepared/unconfirmed audit before handoff");
check(ui.includes('preparedMessage?.channel==="text_prepared"')&&ui.includes('copyVoiceField(preparedMessage.body'),"Owner can copy the exact saved prepared message into Voice");
check(ui.includes('copyVoiceField(customer.phone')&&ui.includes('href={GOOGLE_VOICE_URL}'),"Recipient is copyable and verified Google Voice site is opened separately");
check(ui.includes("confirmSent=async()=>")&&ui.includes("ownerConfirmedSent:true"),"Owner-confirmation audit remains explicit and separate from preparation");
check(action.includes('https://voice.google.com/')&&action.includes("Copy number")&&action.includes("Nothing is marked sent by FIRE unless you confirm it."),"Quick contact action does not claim automated Google Voice delivery");
check(action.includes("JSON.stringify({ phone: recipient, message })")&&action.includes("encodeURIComponent(JSON.stringify"),"Direct text uses serialized encoded JSON with validated phone and exact message");
check(ui.includes('message={preparedMessage.body} label="Text"')&&action.includes("name=FIRE%20Google%20Voice%20Text&input=text&text="),"Owner-tested direct text receives verified saved body; Call Shortcut stays separate");
check(!/\bgooglevoice:\/\//i.test(action),"No unsupported iPhone Google Voice deep link assumed");
check(!/\b(?:twilio|sms\.send|GoogleVoiceAPI)\b/i.test(action),"No paid provider, fabricated SMS API, or automatic send path introduced");
check(action.includes('GOOGLE_VOICE_TEXT_URL_LIMIT = 8000')&&action.includes('href.length <= GOOGLE_VOICE_TEXT_URL_LIMIT'),"Oversized encoded input refused, never truncated");
check(action.includes('window.location.assign(href)')&&!action.includes('setTimeout(')&&!action.includes('fetch('),"User-initiated handoff has no timer, callback, send receipt or database write");
check(action.includes('Only retry if this message was NOT sent')&&action.includes('supportsGoogleVoiceTextShortcut'),"Unsupported devices/launch failure and unsent retries preserve manual control");
const css=readFileSync("app/globals.css","utf8");
const templates=readFileSync("lib/fire-templates.ts","utf8");
check(ui.includes('<DialogHeader className="message-dialog-header"><DialogTitle>Message</DialogTitle><p className="message-dialog-recipient">To: {customer.name}</p>'),"Real composer uses short title and separate recipient, leaving X space");
check(css.includes('.message-dialog .message-dialog-header{')&&css.includes('padding-right:56px')&&css.includes('.message-dialog .message-dialog-recipient{'),"Composer header reserves 56px for mobile close button and wraps customer names");
check(ui.includes('}>Template</Label>')&&ui.includes('>Message text</Label>'),"Composer field labels are concise without changing IDs or handlers");
check(action.includes('className="voice-contact-recipient"')&&action.includes('placeholder="Write your message…"')&&action.includes('>Manual options</p>'),"Quick Voice handoff groups recipient and removes redundant directions");
check(templates.includes('A 50% deposit is required to book; the balance is due upon completion.')&&templates.includes('Review and approve: @estimate_link'),"Short default estimate template retains link, approval and financial terms");
console.log("PASS "+checks+"/"+checks+" source-only Google Voice messaging safety checks. No calls, customer data, or deployment.");
