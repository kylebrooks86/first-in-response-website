/**
 * Manual FIRE customer flags are append-only saved customer notes.
 * A prefixed event is an owner log, NOT verification from Google or a platform.
 * No schema migration or automatic database writes are required.
 */
export const REVIEW_RECEIVED_NOTE="[FIRE FLAG] REVIEW_RECEIVED";
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
  let sign:{state:"out"|"picked_up";at:string;pickupDate:string|null;location:string}|null=null;
  for(const note of ordered){
    if(note.body===REVIEW_RECEIVED_NOTE)reviewReceivedAt=note.createdAt;
    const currentSign=sign as {state:"out"|"picked_up";at:string;pickupDate:string|null;location:string}|null;
    if(note.body===SIGN_PICKED_UP_NOTE&&currentSign?.state==="out")sign={state:"picked_up",at:note.createdAt,pickupDate:currentSign.pickupDate,location:currentSign.location};
    const placed=/^\[FIRE FLAG\] YARD_SIGN_PLACED \| pickup:(\d{4}-\d{2}-\d{2}) \| location:(.{0,180})$/.exec(note.body);
    if(placed){
      const date=placed[1];
      if(Number.isFinite(Date.parse(date+"T12:00:00Z"))&&new Date(date+"T12:00:00Z").toISOString().slice(0,10)===date)sign={state:"out",at:note.createdAt,pickupDate:date,location:placed[2]};
    }
  }
  return {reviewReceivedAt,sign};
}

/** A conservative internal review-status check, never permission to resend.
 * Only recorded/confirmed review requests on completed work are eligible.
 * Missing or invalid timestamps never create due reminders.
 */
export function reviewFollowupEligibility(
 estimates:readonly {status:string;lastReviewRequestAt?:string|null}[],
 messages:readonly {template:string;channel:string;createdAt:string}[],
 reviewReceivedAt:string|null,
 now:number=Date.now()
):{status:"received"|"not-applicable"|"not-recorded"|"waiting"|"due";requestedAt:string|null;elapsedDays:number}{
 if(reviewReceivedAt)return {status:"received",requestedAt:null,elapsedDays:0};
 if(!estimates.some(e=>e.status==="completed"))return {status:"not-applicable",requestedAt:null,elapsedDays:0};
 const recorded=[
  ...estimates.map(e=>e.lastReviewRequestAt).filter((s):s is string=>typeof s==="string"),
  ...messages.filter(m=>m.template==="review"&&(m.channel==="text_confirmed"||m.channel==="email_confirmed")).map(m=>m.createdAt)
 ];
 const times=recorded.map(s=>({s,at:Date.parse(s)})).filter(v=>Number.isFinite(v.at)&&v.at<=now).sort((a,b)=>b.at-a.at);
 if(!times.length)return {status:"not-recorded",requestedAt:null,elapsedDays:0};
 const latest=times[0],elapsedDays=Math.floor((now-latest.at)/86400000);
 return {status:elapsedDays>=7?"due":"waiting",requestedAt:latest.s,elapsedDays};
}
