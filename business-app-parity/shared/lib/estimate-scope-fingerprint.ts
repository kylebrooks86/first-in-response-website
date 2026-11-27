import {env} from 'cloudflare:workers';
type ScopeItem={id:string;name:string;description:string|null;quantity:number;unit:string;totalCents:number};
/** All original service-line terms, not merely their sum: detects $0 or offsetting edits. */
export async function estimateScopeFingerprint(id:string):Promise<string>{
 const rows=await env.DB.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid ASC').bind(id).all<ScopeItem>();
 const items=rows.results;
 if(items.length<1||items.length>60||items.some(p=>
  typeof p.id!=='string'||!p.id||
  typeof p.name!=='string'||!p.name||
  !(p.description===null||typeof p.description==='string')||
  typeof p.unit!=='string'||
  typeof p.quantity!=='number'||!Number.isFinite(p.quantity)||p.quantity<=0||
  typeof p.totalCents!=='number'||!Number.isSafeInteger(p.totalCents)||p.totalCents<0))
  throw Error('Original estimate service scope requires manual review.');
 const canonical=JSON.stringify(items.map(p=>[p.id,p.name,p.description??'',p.quantity,p.unit,p.totalCents]));
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
