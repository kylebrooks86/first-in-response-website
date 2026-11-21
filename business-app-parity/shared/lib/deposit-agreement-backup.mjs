/** Signed immutable agreement artifact: backup validation and exact recovery semantics. */
export const SIGNED_AGREEMENT_COLUMNS=Object.freeze(["event_id","estimate_id","document_version","document_digest","total_cents","deposit_cents","mode","scope_json","agreement_text","signed_name","photo_release","signed_at","accepted_at"]);
const valid=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const nonempty=s=>typeof s==='string'&&s.trim().length>0;
export function validateSignedAgreementSnapshots(tables,required=false){
 const rows=tables?.deposit_agreement_snapshots;
 if(rows===undefined)return required?'Backup declares signed agreements but omits their records.':null;
 if(!Array.isArray(rows))return 'Signed agreement history must be an array.';
 const estimates=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).map(e=>[e.id,e]));
 const events=new Map((Array.isArray(tables.deposit_policy_events)?tables.deposit_policy_events:[]).map(e=>[e.id,e]));
 const seen=new Set(),versions=new Set();
 for(const [i,s] of rows.entries()){
  const fail=m=>'Signed agreement row '+i+' '+m;
  if(!s||typeof s!=='object'||Array.isArray(s)||SIGNED_AGREEMENT_COLUMNS.some(k=>!Object.hasOwn(s,k)))return fail('has missing columns.');
  if(!nonempty(s.event_id)||seen.has(s.event_id))return fail('has duplicate or blank event ID.');seen.add(s.event_id);
  if(!nonempty(s.document_version)||versions.has(s.document_version)||s.document_version!=='deposit-exception-v1:'+s.event_id)return fail('has inconsistent version.');versions.add(s.document_version);
  if(!/^[0-9a-f]{64}$/.test(s.document_digest))return fail('has invalid SHA-256 digest.');
  const e=estimates.get(s.estimate_id),a=events.get(s.event_id);
  if(!e||!a||a.estimate_id!==s.estimate_id)return fail('references a missing or mismatched estimate/audit.');
  if(!valid(s.total_cents)||!valid(s.deposit_cents)||s.deposit_cents>s.total_cents||s.total_cents!==a.previous_total_cents||s.deposit_cents!==a.new_deposit_cents||s.mode!==a.mode)return fail('has inconsistent financial terms.');
  if(!nonempty(s.scope_json)||s.scope_json.length>100000||!nonempty(s.agreement_text)||s.agreement_text.length>50000||s.agreement_text.length<50)return fail('has invalid preserved document text.');
  let scope;try{scope=JSON.parse(s.scope_json);}catch{return fail('has invalid scope JSON.');}
  if(!Array.isArray(scope)||!scope.length||scope.length>100||scope.some(x=>!Array.isArray(x)||x.length!==6||typeof x[0]!=='string'||!x[0]||typeof x[1]!=='string'||!x[1].trim()||typeof x[2]!=='string'||!Number.isInteger(x[3])||x[3]<=0||typeof x[4]!=='string'||!valid(x[5])))return fail('has invalid service scope.');
  if(!nonempty(s.signed_name)||s.signed_name.trim().length<2||s.signed_name.length>120||!['yes','no'].includes(s.photo_release)||!nonempty(s.accepted_at)||!nonempty(s.signed_at)||!Number.isFinite(Date.parse(s.accepted_at))||!Number.isFinite(Date.parse(s.signed_at)))return fail('has invalid signature receipt.');
  if(e.contract_version!==s.document_version+':sha256:'+s.document_digest||e.signed_name!==s.signed_name||e.photo_release!==s.photo_release||e.accepted_at!==s.accepted_at||e.signed_at!==s.signed_at)return fail('does not match signed estimate receipt.');
 }
 return null;
}
export function signedAgreementRowsConflict(a,b){return SIGNED_AGREEMENT_COLUMNS.some(k=>a?.[k]!==b?.[k]);}

/** Recheck all signed document commitments against preserved exact bytes. */
export async function verifySignedAgreementDigests(tables){
 const rows=tables?.deposit_agreement_snapshots;
 if(rows===undefined)return null;
 if(!Array.isArray(rows))return 'Signed agreement history must be an array.';
 for(const row of rows){
  if(!row||typeof row!=='object'||typeof row.scope_json!=='string'||typeof row.agreement_text!=='string')return 'Signed agreement source is incomplete.';
  const source=JSON.stringify({format:'deposit-exception-v1',eventId:row.event_id,totalCents:row.total_cents,depositCents:row.deposit_cents,mode:row.mode,scope:row.scope_json,terms:row.agreement_text});
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  const digest=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==row.document_digest)return 'Signed agreement document digest differs from archived text or scope.';
 }
 return null;
}
