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
