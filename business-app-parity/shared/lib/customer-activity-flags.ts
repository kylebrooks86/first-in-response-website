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
    if(note.body===SIGN_PICKED_UP_NOTE&&sign?.state==="out")sign={...sign,state:"picked_up",at:note.createdAt};
    const placed=/^\[FIRE FLAG\] YARD_SIGN_PLACED \| pickup:(\d{4}-\d{2}-\d{2}) \| location:(.{0,180})$/.exec(note.body);
    if(placed){
      const date=placed[1];
      if(Number.isFinite(Date.parse(date+"T12:00:00Z"))&&new Date(date+"T12:00:00Z").toISOString().slice(0,10)===date)sign={state:"out",at:note.createdAt,pickupDate:date,location:placed[2]};
    }
  }
  return {reviewReceivedAt,sign};
}
