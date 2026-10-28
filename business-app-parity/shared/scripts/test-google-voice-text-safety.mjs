/** Source-only regression contract: business primary and explicitly warned personal emergency backups. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui=readFileSync("app/dashboard.tsx","utf8");
const action=readFileSync("components/google-voice-text-action.tsx","utf8");
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;console.log("PASS: "+label);}
check(!/sms:/i.test(ui),"No personal-number sms: route remains in main FIRE dashboard");
check((ui.match(/<GoogleVoiceTextAction\b/g)||[]).length===5,"All five direct customer Text shortcuts use business Google Voice handoff");
check((ui.match(/<GoogleVoiceCallAction\b/g)||[]).length===5,"All five direct customer Call buttons use business Google Voice handoff");
check((ui.match(/<PersonalPhoneBackupAction\b/g)||[]).length===11,"Personal backup options exist on five call, five text and prepared-message actions");
check(action.includes("window.confirm(warning)") && action.includes("PERSONAL cellphone number") && action.includes("Phone app"),"Personal backups warn before exposing the owner number");
check(action.includes('"sms:" : "tel:"') && !/sms:|tel:/i.test(ui),"Personal iPhone routing is isolated to warned backup action, not primary app buttons");
check(ui.includes('message={preparedMessage.body}') && action.includes("navigator.clipboard.writeText(personalBackupTextBody(message))"),"Prepared message backup reuses saved template with alternate-number introduction via clipboard");
check(action.includes("Hi, this is First In Response Exteriors. We\'re using an alternate number today."),"All personal backup SMS texts begin with the correct alternate-number disclosure");
check(action.includes("PERSONAL_BACKUP_TEXT_INTRO + \"\\n\\n\" + original"),"Alternate-number notice prepends without editing saved message template");
check(ui.includes("message={contactDraft?.jobId===job.id?contactDraft.text:undefined}"),"Schedule reminders and on-my-way drafts flow into both text actions");
check(ui.includes('if(!await log("text_prepared"))return')&&ui.includes("setMessageStatus(\"Prepared for Google Voice."),"Message composer preserves saved prepared/unconfirmed audit before handoff");
check(ui.includes('preparedMessage?.channel==="text_prepared"')&&ui.includes('navigator.clipboard.writeText(preparedMessage.body)'),"Owner can copy the exact saved prepared message into Voice");
check(ui.includes('navigator.clipboard.writeText(customer.phone)')&&ui.includes('href={GOOGLE_VOICE_URL}'),"Recipient is copyable and verified Google Voice site is opened separately");
check(ui.includes("confirmSent=async()=>")&&ui.includes("ownerConfirmedSent:true"),"Owner-confirmation audit remains explicit and separate from preparation");
check(action.includes('https://voice.google.com/')&&action.includes("Copy number")&&action.includes("Nothing is marked sent by FIRE unless you confirm it."),"Quick contact action does not claim automated Google Voice delivery");
check(!ui.includes("Use iPhone Shortcut")&&!action.includes("Use iPhone Shortcut"),"Failed Google Voice native Shortcut send action is not offered to customers");
check(!ui.includes("googleVoiceShortcutHref")&&!action.includes("shortcuts://run-shortcut"),"No broken native SMS Shortcut URL remains in draft handoff");
check(!/\bgooglevoice:\/\//i.test(action),"No unsupported iPhone Google Voice deep link assumed");
check(!/\b(?:twilio|sms\.send|GoogleVoiceAPI)\b/i.test(action),"No paid provider, fabricated SMS API, or automatic send path introduced");
console.log("PASS "+checks+"/"+checks+" source-only Google Voice messaging safety checks. No calls, customer data, or deployment.");
