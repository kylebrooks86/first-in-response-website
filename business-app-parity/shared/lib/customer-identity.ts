export type CustomerIdentity={name:string;email:string;phone:string;address:string};
const digits="replace(replace(replace(replace(replace(replace(COALESCE(phone,''),' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
export const CUSTOMER_PHONE_SQL=`(CASE WHEN length(${digits})=11 AND substr(${digits},1,1)='1' THEN substr(${digits},2) ELSE ${digits} END)`;
export function customerIdentityPredicate(input:CustomerIdentity){
 const email=input.email.trim().toLowerCase(),raw=input.phone.replace(/\D/g,''),phone=raw.length===11&&raw.startsWith('1')?raw.slice(1):raw;
 const name=input.name.trim().toLowerCase(),address=input.address.trim().toLowerCase();
 return {sql:`((?<>'' AND lower(trim(COALESCE(email,'')))=?) OR (?<>'' AND ${CUSTOMER_PHONE_SQL}=?) OR (?<>'' AND ?<>'' AND lower(trim(name))=? AND lower(trim(COALESCE(address,'')))=?))`,values:[email,email,phone,phone,name,address,name,address]};
}
export async function duplicateCustomer(db:D1Database,input:CustomerIdentity){
 const match=customerIdentityPredicate(input);
 return db.prepare(`SELECT id FROM customers WHERE ${match.sql} LIMIT 1`).bind(...match.values).first<{id:string}>();
}

export async function customerCreationReceipt(db:D1Database,id:string){
 return db.prepare(`SELECT c.id,c.name,COALESCE(c.email,'') AS email,COALESCE(c.phone,'') AS phone,COALESCE(c.address,'') AS address,COALESCE(c.lead_source,'Unknown') AS leadSource,c.created_at AS createdAt,
 (SELECT COUNT(*) FROM estimates e WHERE e.customer_id=c.id) AS estimateCount,
 COALESCE((SELECT SUM(COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents)) FROM estimates e WHERE e.customer_id=c.id),0) AS estimateTotal,
 COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN estimates e ON e.id=p.estimate_id WHERE e.customer_id=c.id AND p.status='paid' AND p.type NOT IN ('Tip','Tip Refund')),0) AS paidTotal FROM customers c WHERE c.id=?`).bind(id).first<{id:string;name:string;email:string;phone:string;address:string;leadSource:string;createdAt:string;estimateCount:number;estimateTotal:number;paidTotal:number}>();
}
