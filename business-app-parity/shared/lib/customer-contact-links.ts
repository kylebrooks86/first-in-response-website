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
