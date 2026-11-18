/** Safe, normalized destinations for customer-profile native Call / Text / Email links.
 * This does not edit the saved contact field or claim that it was verified by a provider.
 * Reject malformed data rather than opening a phone/email app with a broken recipient.
 */
export function usableCustomerPhone(value?:string|null):string|null{
 const raw=value?.trim()??'';
 if(!raw||!/^[+0-9().\s-]+$/.test(raw))return null;
 const digits=raw.replace(/\D/g,'');
 if(digits.length===10)return '+1'+digits;
 if(digits.length===11&&digits.startsWith('1'))return '+'+digits;
 return null;
}
export function usableCustomerEmail(value?:string|null):string|null{
 const raw=value?.trim()??'';
 return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(raw)?raw:null;
}

/**
 * Owner-controlled contact handoff guard. A valid contact and a meaningful,
 * nonblank draft are required before creating an immutable 'prepared' record.
 * This never sends a message, infers delivery, or chooses a personal-number
 * fallback. Text uses the saved FIRE Google Voice workflow; email opens the
 * user's chosen mail app after explicit separate handoff.
 */
export type CustomerMessageChannel = "text" | "email";
export function customerMessageHandoffReadiness(
 channel:CustomerMessageChannel,
 recipient:string|null|undefined,
 body:string
):{ready:boolean;reason:string}{
 const usable=channel==="text"?usableCustomerPhone(recipient):usableCustomerEmail(recipient);
 if(!usable)return {
  ready:false,
  reason:channel==="text"
   ?"Add a valid customer mobile/contact number before preparing a Google Voice text."
   :"Add a valid customer email address before preparing an email."
 };
 if(!body.trim())return {
  ready:false,
  reason:channel==="text"
   ?"Write your text first, then tap Text to prepare it for Google Voice. FIRE will not send automatically."
   :"Write your email first, then tap Email to prepare it. FIRE will not send automatically."
 };
 return{ready:true,reason:""};
}

/** 400/404 are issued by the preparation API before any INSERT.
 * 409 may indicate a previously saved immutable draft or a business hold;
 * 5xx, network loss and timeouts cannot establish noncommit.
 * Auth 401 is explicitly handled independently by the caller.
 */
export function definitiveUnwrittenMessagePreparation(status:number):boolean{
 return status===400||status===404;
}

/**
 * A prepared estimate/invoice notification must include its actual share URL.
 * Never silently replace @estimate_link or @invoice_link with an empty string
 * and let the owner prepare a message that cannot open the customer's record.
 * Custom messages without either placeholder are unaffected.
 */
/** Reject unsafe or non-document URLs before a customer sees a prepared
 * estimate/invoice message. Deployed customer links must be HTTPS; local
 * loopback HTTP is retained solely for offline Chrome fixture development.
 * This is format validation, not proof the remote share token is active.
 */
function usablePreparedDocumentLink(value:string,kind:"estimate"|"invoice"):boolean{
 try{
  const url=new URL(value);
  const loopback=url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="[::1]";
  if(url.protocol!=="https:"&&!(url.protocol==="http:"&&loopback))return false;
  if(url.username||url.password||!url.hostname||!url.pathname.startsWith("/"+kind+"/")||
     url.pathname==="/"+kind+"/"||url.hash)return false;
  return true;
 }catch{return false;}
}

export function customerTemplateLinkReadiness(
 templateBody:string,
 templateSubject:string,
 draftBody:string,
 estimateLink:string,
 invoiceLink:string
):{ready:boolean;requiresEstimate:boolean;requiresInvoice:boolean;reason:string}{
 const source=templateBody+" "+templateSubject;
 const requiresEstimate=source.includes("@estimate_link");
 const requiresInvoice=source.includes("@invoice_link");
 const blocked=(reason:string)=>({ready:false,requiresEstimate,requiresInvoice,reason});
 // No real report share URL is provided by this composer. An arbitrary
 // non-URL label must never be substituted into a report link template.
 if(source.includes("@form_link"))
  return blocked("Report links are not available from this message editor. Update this template in Settings to remove @form_link, then attach or share the real report manually.");
 if(requiresEstimate&&!usablePreparedDocumentLink(estimateLink,"estimate"))return blocked("Estimate link is not ready or is not a secure estimate URL. Prepare or retry the link before this message.");
 if(requiresInvoice&&!usablePreparedDocumentLink(invoiceLink,"invoice"))return blocked("Invoice link is not ready or is not a secure invoice URL. Prepare or retry the link before this message.");
 if(requiresEstimate&&!draftBody.includes(estimateLink))return blocked("Estimate link is missing from this draft. Choose the template again or paste the link.");
 if(requiresInvoice&&!draftBody.includes(invoiceLink))return blocked("Invoice link is missing from this draft. Choose the template again or paste the link.");
 return{ready:true,requiresEstimate,requiresInvoice,reason:""};
}

/** Tulsa-local calendar logic for the FIRE 24-hour / "tomorrow" reminder.
 * A 24-hour reminder speaks about TOMORROW, not an arbitrary future appointment.
 * Format-to-parts is deliberately used instead of browser/system local time:
 * the owner's phone, a UTC Worker and the SQLite runner must agree on the day.
 */
const tulsaDayFormatter=new Intl.DateTimeFormat("en-US",{
 timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
});
function tulsaDayKey(time:number):string|null{
 if(!Number.isFinite(time))return null;
 const parts=tulsaDayFormatter.formatToParts(new Date(time));
 const value=(name:string)=>parts.find(part=>part.type===name)?.value??"";
 const year=value("year"),month=value("month"),day=value("day");
 return /^\d{4}$/.test(year)&&/^\d{2}$/.test(month)&&/^\d{2}$/.test(day)
  ?year+"-"+month+"-"+day:null;
}
function nextTulsaDayKey(now:number):string|null{
 const today=tulsaDayKey(now);
 if(!today)return null;
 const [year,month,day]=today.split("-").map(Number);
 const next=new Date(Date.UTC(year,month-1,day+1));
 return next.toISOString().slice(0,10);
}
export function customerReminderIsTomorrowInTulsa(scheduledAt:string|null|undefined,now:number=Date.now()):boolean{
 const instant=scheduledAt?Date.parse(scheduledAt):NaN;
 return Number.isFinite(instant)&&Number.isFinite(now)&&instant>now&&
   tulsaDayKey(instant)===nextTulsaDayKey(now);
}
/** Exact UTC midnight when "tomorrow" becomes "today" in Tulsa.
 * Binary-searching the Tulsa date boundary is DST-safe even for spring/fall
 * transitions; a fixed -5/-6 hour offset is wrong on transition days.
 * The server binds this expiry into the same SQLite INSERT that saves a draft.
 */
export function tulsaReminderExpiryUtc(now:number=Date.now()):string|null{
 const target=nextTulsaDayKey(now);
 if(!target)return null;
 const [year,month,day]=target.split("-").map(Number);
 const candidate=Date.UTC(year,month-1,day);
 let low=candidate-12*3600_000,high=candidate+18*3600_000;
 while(low<high){
  const middle=low+Math.floor((high-low)/2000)*1000;
  if((tulsaDayKey(middle)??'')<target)low=middle+1000;
  else high=middle;
 }
 return new Date(low).toISOString();
}

/**
 * A canned appointment confirmation/reminder must come from the actual
 * selected saved job, not a generic "your scheduled time" fallback. Custom
 * messages and non-appointment templates are not subject to this gate.
 */
export function customerAppointmentTemplateReadiness(
 templateBody:string,
 templateSubject:string,
 scheduledAt:string|null|undefined,
 status:string|null|undefined,
 address:string|null|undefined,
 now:number=Date.now(),
 templateKey?:string
):{ready:boolean;reason:string}{
 const source=templateBody+" "+templateSubject;
 // A saved owner may edit out the date placeholder and "tomorrow" wording.
 // The selected built-in appointment template identity is still a scheduling
 // assertion, so client checks must match the keyed server's stricter rule.
 const isAppointmentTemplate=templateKey==="appointment"||templateKey==="appointmentReminder";
 if(!source.includes("@schedule_date")&&!isAppointmentTemplate)return{ready:true,reason:""};
 const appointmentAt=scheduledAt?Date.parse(scheduledAt):NaN;
 if(status!=="scheduled"||!Number.isFinite(appointmentAt))
  return{ready:false,reason:"Save and confirm this job's appointment date before preparing an appointment confirmation or reminder."};
 // A stale saved "scheduled" status is not proof an appointment is still upcoming.
 // Recheck wall-clock time at the actual preparation click as well as render.
 if(!Number.isFinite(now)||appointmentAt<=now)
  return{ready:false,reason:"This saved appointment time has passed or cannot be verified. Check the job status before preparing a confirmation or reminder. Use a custom message if follow-up is needed."};
 if(source.includes("@service_address")&&!address?.trim())
  return{ready:false,reason:"Save a service address for this scheduled job before preparing an appointment confirmation."};
 if((templateKey==="appointmentReminder"||/\btomorrow\b/i.test(templateSubject))&&
    !customerReminderIsTomorrowInTulsa(scheduledAt,now))
  return{ready:false,reason:"The 24-hour reminder says tomorrow, but this saved appointment is not tomorrow in Tulsa. Use Appointment confirmation for a later date, or prepare the reminder the day before service."};
 return{ready:true,reason:""};
}
