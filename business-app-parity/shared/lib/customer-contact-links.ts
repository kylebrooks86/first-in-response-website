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
