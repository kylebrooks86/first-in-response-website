type AuditMessage = {id:string; customerId:string; estimateId?:string|null; channel:string; template:string; body:string; createdAt:string};

// Presentation only: immutable database events remain available in the backup/audit.
// Link only the backend's exact confirmation identity, never similar text or dates.
export function messageHistoryEntries<T extends AuditMessage>(messages:T[]):{message:T;prepared?:T}[] {
  const byId=new Map(messages.map(message=>[message.id,message]));
  const paired=new Set<string>();
  const entries=messages.map(message=>{
    if(message.channel!=="text_confirmed"&&message.channel!=="email_confirmed")return {message};
    const suffix=":owner-confirmed";
    const prepared=message.id.endsWith(suffix)?byId.get(message.id.slice(0,-suffix.length)):undefined;
    if(!prepared||prepared.channel!==message.channel.replace("_confirmed","_prepared")||prepared.customerId!==message.customerId||prepared.estimateId!==message.estimateId||prepared.template!==message.template||prepared.body!==message.body)return {message};
    paired.add(prepared.id);
    return {message,prepared};
  });
  return entries.filter(entry=>!paired.has(entry.message.id));
}
