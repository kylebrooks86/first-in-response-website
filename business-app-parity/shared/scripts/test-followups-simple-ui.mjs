/** Follow-ups progressive disclosure is presentation only, never a send claim. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("app/dashboard.tsx","utf8");
const css=readFileSync("app/globals.css","utf8");
const timing=readFileSync("lib/follow-up-timing.ts","utf8");
const start=ui.indexOf("function FollowUpsView("),end=ui.indexOf("function PaymentsView(",start);
assert.ok(start>=0&&end>start,"Full source Follow-ups view exists");
const section=ui.slice(start,end);
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}

const contactStart=section.indexOf('className="followup-contact-actions"'),optionalStart=section.indexOf('className="followup-optional-tools"');
check(contactStart>=0&&optionalStart>contactStart,"Default contacts precede optional tools");
const immediate=section.slice(contactStart,optionalStart);
check(immediate.includes("GoogleVoiceCallAction")&&immediate.includes("Open email app for "), "Call and email remain immediately accessible when available");
check(!immediate.includes("PersonalPhoneBackupAction")&&!immediate.includes('initialTemplate="custom"'),"Personal-number backup and extra custom text no longer crowd immediate actions");
const optional=section.slice(optionalStart,section.indexOf('className="followup-contact-panel"',optionalStart));
check(optional.includes('<summary>More options</summary>')&&optional.includes('className="followup-backup-tools"'),"Optional controls start collapsed without removing actions");
check(optional.includes('initialTemplate="custom" triggerLabel="Write custom text"'),"Custom text option remains reachable");
check((optional.match(/<PersonalPhoneBackupAction/g)||[]).length===2&&optional.includes('mode="call"')&&optional.includes('mode="text"'),"Both backup methods retained behind an explicit second disclosure");
check(optional.includes("Your personal number may be shown."),"Personal phone disclosure warns owner before use");
check(optional.includes("Recent contact")&&optional.includes("Open estimate")&&optional.includes("Customer history")&&optional.includes("Saved estimate activity ("),"Saved activity and navigation remain reachable");
check(section.includes('triggerLabel="Prepare message"')&&section.includes("onSent={(message,status)=>"),"Primary prepared template still requires separate confirmed send result");
check(section.includes('className="followup-message-details"')&&section.includes("sending unconfirmed")&&section.includes('contactHistory.status'),"Unconfirmed messages and full histories remain distinguishable");
check(section.includes('latest.kind==="prepared"?"Message prepared · sending unconfirmed":"Check contact history before outreach"')&&section.includes('Review estimate</Button>'),"Unverified history asks for inspection rather than new outreach and never claims a prepared message was sent");
check(section.includes('Details{bucketCount("due")+bucketCount("past-target")>0?')&&section.includes("bucketCount(\"review\")"),"Summary hides misleading zero due counts while keeping a full urgency breakdown");
check(section.includes('actionFilter!=="all"||highPriorityOnly||urgencyFilter!=="all"')&&section.includes("matching of {actions.length}"),"Filter count shown only when filter modifies the full list");
check(section.includes('reason:"Paid job · invite an honest review"')&&timing.includes('label:"Review suggested"'),"Review suggestion never steers customer ratings");
check(css.includes(".followups-view .followup-backup-tools>summary:focus-visible")&&css.includes("min-height:48px"),"Nested backup actions keep keyboard focus and large tap targets");
check(!/auto.?send|navigator\.share/.test(optional),"Optional actions do not introduce automatic sending");
check(section.includes('className={"followup-summary "+(bucketCount("due")+bucketCount("past-target")>0?"has-due":"no-due")}')&&
  css.includes(".followups-view .followup-summary.no-due"),
  "When there are zero due or overdue actions the queue is neutral, not alarming red");
const filters=section.slice(section.indexOf('className="followup-filter-panel"'),section.indexOf('className="followup-priority-jumps"'));
check(filters.includes('aria-label="Filter follow-ups: All"')&&
  filters.includes('setActionFilter("all");setUrgencyFilter("all");setHighPriorityOnly(false)'),
  "All visible reset clears every advanced filter together");
check(filters.indexOf('<summary>More filters')<filters.indexOf('[["viewed","Viewed 24h+"]')&&
  filters.indexOf('<summary>More filters')<filters.indexOf('[["no-answer","No answer / Not contacted"]'),
  "Zero-count viewed and no-answer shortcuts stay available but hidden until expanded");
check(section.includes('className="followup-coverage-complete" role="status"')&&
  section.indexOf('estimates checked · all available pages loaded.')<section.indexOf('<summary>More filters'),
  "Completed scan coverage remains available inside the summary instead of repeating above the cards");
check(section.includes('<strong>Check next</strong>')&&
  section.includes('latest.kind==="prepared"?"Message prepared · sending unconfirmed"'),
  "Customer priority displays one concise state without claiming a message was sent");
console.log("PASS "+checks+" source-backed Follow-ups simplification checks. No hosted, customer or message writes.");
