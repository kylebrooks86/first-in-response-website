/**
 * Manual FIRE customer flags are append-only saved customer notes.
 * A prefixed event is an owner log, NOT verification from Google or a platform.
 * No schema migration or automatic database writes are required.
 */
export const REVIEW_RECEIVED_NOTE="[FIRE FLAG] REVIEW_RECEIVED";
export const LEAD_NO_ANSWER_NOTE="[FIRE FLAG] LEAD_NO_ANSWER";
export const LEAD_CONTACTED_NOTE="[FIRE FLAG] LEAD_CONTACT_RECORDED";
export const LEAD_CALLBACK_HANDLED_NOTE="[FIRE FLAG] LEAD_CALLBACK_HANDLED";
/** A requested callback is an owner-tracked date, never a queued message. */
export function leadCallbackNote(dueDate:string){
  const parsed=typeof dueDate==="string"?Date.parse(dueDate+"T12:00:00Z"):NaN;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(parsed)||
    new Date(parsed).toISOString().slice(0,10)!==dueDate)
    throw new Error("Choose a valid callback date.");
  return "[FIRE FLAG] LEAD_CALLBACK | due:"+dueDate;
}
export const SIGN_PICKED_UP_NOTE="[FIRE FLAG] YARD_SIGN_PICKED_UP";
export function signPlacedNote(pickupDate:string,location:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)||new Date(pickupDate+"T12:00:00Z").toISOString().slice(0,10)!==pickupDate)
    throw new Error("Choose a valid yard sign pickup date.");
  return "[FIRE FLAG] YARD_SIGN_PLACED | pickup:"+pickupDate+" | location:"+location.replace(/[\r\n|]/g," ").trim().slice(0,180);
}
type Note={id:string;body:string;createdAt:string};
export function deriveCustomerManualFlags(notes:readonly Note[]){
  const ordered=[...notes].filter(note=>Number.isFinite(Date.parse(note.createdAt))).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
  let reviewReceivedAt:string|null=null;
  // Append-only, owner-reported lead attempts, including customers who have no
  // estimate yet. A failed call never becomes a sent text or completed contact.
  let leadContact:{state:"no_answer"|"contacted";at:string;unansweredAttempts:number}|null=null;
  let unansweredAttempts=0;
  let leadCallback:{state:"pending"|"handled";dueDate:string|null;at:string}|null=null;
  let sign:{state:"out"|"picked_up";at:string;pickupDate:string|null;location:string}|null=null;
  for(const note of ordered){
    if(note.body===REVIEW_RECEIVED_NOTE)reviewReceivedAt=note.createdAt;
    if(note.body===LEAD_NO_ANSWER_NOTE){
      unansweredAttempts++;
      leadContact={state:"no_answer",at:note.createdAt,unansweredAttempts};
    }
    if(note.body===LEAD_CONTACTED_NOTE){
      leadContact={state:"contacted",at:note.createdAt,unansweredAttempts};
      const pending=leadCallback as {state:"pending"|"handled";dueDate:string|null;at:string}|null;
      if(pending?.state==="pending")leadCallback={...pending,state:"handled",at:note.createdAt};
    }
    const requested=/^\[FIRE FLAG\] LEAD_CALLBACK \| due:(\d{4}-\d{2}-\d{2})$/.exec(note.body);
    if(requested){
      const date=requested[1];
      if(Number.isFinite(Date.parse(date+"T12:00:00Z"))&&new Date(date+"T12:00:00Z").toISOString().slice(0,10)===date)
        leadCallback={state:"pending",dueDate:date,at:note.createdAt};
    }
    if(note.body===LEAD_CALLBACK_HANDLED_NOTE){
      const pending=leadCallback as {state:"pending"|"handled";dueDate:string|null;at:string}|null;
      if(pending?.state==="pending")leadCallback={...pending,state:"handled",at:note.createdAt};
    }
    const currentSign=sign as {state:"out"|"picked_up";at:string;pickupDate:string|null;location:string}|null;
    if(note.body===SIGN_PICKED_UP_NOTE&&currentSign?.state==="out")sign={state:"picked_up",at:note.createdAt,pickupDate:currentSign.pickupDate,location:currentSign.location};
    const placed=/^\[FIRE FLAG\] YARD_SIGN_PLACED \| pickup:(\d{4}-\d{2}-\d{2}) \| location:(.{0,180})$/.exec(note.body);
    if(placed){
      const date=placed[1];
      if(Number.isFinite(Date.parse(date+"T12:00:00Z"))&&new Date(date+"T12:00:00Z").toISOString().slice(0,10)===date)sign={state:"out",at:note.createdAt,pickupDate:date,location:placed[2]};
    }
  }
  return {reviewReceivedAt,sign,leadContact,leadCallback};
}

/** A conservative internal review-status check, never permission to resend.
 * Only recorded/confirmed review requests on completed work are eligible.
 * Missing or invalid timestamps never create due reminders.
 */
export function reviewFollowupEligibility(
 estimates:readonly {id?:string;status:string;lastReviewRequestAt?:string|null}[],
 messages:readonly {estimateId?:string|null;template:string;channel:string;createdAt:string;body?:string}[],
 reviewReceivedAt:string|null,
 now:number=Date.now()
):{status:"received"|"not-applicable"|"not-recorded"|"waiting"|"due";requestedAt:string|null;elapsedDays:number}{
 if(reviewReceivedAt)return {status:"received",requestedAt:null,elapsedDays:0};
 const completed=estimates.filter(e=>e.status==="completed");
 if(!completed.length)return {status:"not-applicable",requestedAt:null,elapsedDays:0};
 const completedIds=new Set(completed.map(e=>e.id).filter((id):id is string=>typeof id==="string"&&id.length>0));
 // A confirmed request on an unfinished DIFFERENT job is not a completed-job
 // review follow-up. Legacy simplified check fixtures have no IDs; preserve
 // their independent caller behavior without weakening real linked records.
 const recorded=[
  ...completed.map(e=>e.lastReviewRequestAt).filter((s):s is string=>typeof s==="string"),
  ...messages.filter(m=>m.template==="review"&&(m.channel==="text_confirmed"||m.channel==="email_confirmed")&&
    (!completedIds.size||(typeof m.estimateId==="string"&&completedIds.has(m.estimateId)))).map(m=>m.createdAt)
 ];
 const times=recorded.map(s=>({s,at:Date.parse(s)})).filter(v=>Number.isFinite(v.at)&&v.at<=now).sort((a,b)=>b.at-a.at);
 if(!times.length)return {status:"not-recorded",requestedAt:null,elapsedDays:0};
 const latest=times[0],elapsedDays=Math.floor((now-latest.at)/86400000);
 // A deliberate OWNER review-status check deferral is independent of asking for
 // a review. It never indicates a review was received or a text was sent.
 // A newer review request always overrides a prior check deferral.
 const deferred=messages.some(m=>{
  if(m.template!=="reviewCheckSnooze"||m.channel!=="review_check_snoozed"||typeof m.body!=="string")return false;
  const created=Date.parse(m.createdAt),until=Date.parse(m.body);
  return Number.isFinite(created)&&created>=latest.at&&created<=now&&Number.isFinite(until)&&until>now;
 });
 return {status:deferred||elapsedDays<7?"waiting":"due",requestedAt:latest.s,elapsedDays};
}
