/** Source-only regression contract: FIRE never offers owner's personal Messages app for customer texting. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui=readFileSync("app/dashboard.tsx","utf8");
const action=readFileSync("components/google-voice-text-action.tsx","utf8");
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;console.log("PASS: "+label);}
check(!/sms:/i.test(ui),"No personal-number sms: route remains in main FIRE dashboard");
check((ui.match(/<GoogleVoiceTextAction\b/g)||[]).length===5,"All five direct customer Text shortcuts use business Google Voice handoff");
check(ui.includes('if(!await log("text_prepared"))return')&&ui.includes("setMessageStatus(\"Prepared for Google Voice."),"Message composer preserves saved prepared/unconfirmed audit before handoff");
check(ui.includes('preparedMessage?.channel==="text_prepared"')&&ui.includes('navigator.clipboard.writeText(preparedMessage.body)'),"Owner can copy the exact saved prepared message into Voice");
check(ui.includes('navigator.clipboard.writeText(customer.phone)')&&ui.includes('href={GOOGLE_VOICE_URL}'),"Recipient is copyable and verified Google Voice site is opened separately");
check(ui.includes("confirmSent=async()=>")&&ui.includes("ownerConfirmedSent:true"),"Owner-confirmation audit remains explicit and separate from preparation");
check(action.includes('https://voice.google.com/')&&action.includes("Copy number")&&action.includes("Opening Voice does not send anything automatically."),"Quick contact action does not claim automated Google Voice delivery");
check(!/\bgooglevoice:\/\//i.test(action),"No unsupported iPhone Google Voice deep link assumed");
check(!/\b(?:twilio|sms\.send|GoogleVoiceAPI)\b/i.test(action),"No paid provider, fabricated SMS API, or automatic send path introduced");
console.log("PASS "+checks+"/"+checks+" source-only Google Voice messaging safety checks. No calls, customer data, or deployment.");
