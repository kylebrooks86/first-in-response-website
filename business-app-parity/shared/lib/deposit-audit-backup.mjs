/**
 * Fail-closed, independent validation of immutable owner deposit history.
 * Older pre-feature backups may legitimately omit this collection, but new
 * app exports advertise includes.depositPolicyAuditHistory and must contain it.
 */
export const DEPOSIT_AUDIT_COLUMNS = Object.freeze(["id","estimate_id","confirmation_id","actor_email","mode","previous_total_cents","previous_deposit_cents","new_deposit_cents","paid_principal_cents","percent_basis_points","schedule_before_collection","previous_contract_version","updated_contract_version","previous_signed_at","requires_customer_reapproval","reason","created_at"]);
const MODES=new Set(["standard","waive","percentage","fixed","schedule-before-deposit","restore-standard"]);
const maximum=Number.MAX_SAFE_INTEGER;
const validCents=n=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0&&n<=maximum;
const own=(row,key)=>Object.prototype.hasOwnProperty.call(row,key);
export function validateDepositAuditIntegrity(tables,requirePresence=false){
 const rows=tables?.deposit_policy_events;
 if(rows===undefined)return requirePresence?"Missing declared deposit audit history.":null;
 if(!Array.isArray(rows))return "Deposit audit history must be an array.";
 const known=new Set(Array.isArray(tables?.estimates)?tables.estimates.map(r=>r?.id):[]);
 const ids=new Set(),confirmations=new Set();
 for(const [index,row] of rows.entries()){
  const label="Deposit audit row "+index;
  if(!row||typeof row!=="object"||Array.isArray(row)||DEPOSIT_AUDIT_COLUMNS.some(k=>!own(row,k)))return label+" has missing fields.";
  if(typeof row.id!=="string"||!row.id||ids.has(row.id))return label+" has duplicate/blank event ID.";
  if(typeof row.confirmation_id!=="string"||!row.confirmation_id||confirmations.has(row.confirmation_id))return label+" has duplicate/blank confirmation ID.";
  ids.add(row.id);confirmations.add(row.confirmation_id);
  if(typeof row.estimate_id!=="string"||!known.has(row.estimate_id))return label+" references a missing estimate.";
  if(typeof row.actor_email!=="string"||!row.actor_email.trim())return label+" has no owner identity.";
  if(!MODES.has(row.mode))return label+" has an unknown mode.";
  for(const k of ["previous_total_cents","previous_deposit_cents","new_deposit_cents","paid_principal_cents"]){
   if(!validCents(row[k]))return label+" has invalid "+k+".";
  }
  const total=row.previous_total_cents,old=row.previous_deposit_cents,next=row.new_deposit_cents;
  if(old>total||next>total||row.paid_principal_cents>total)return label+" has inconsistent principal.";
  const basis=row.percent_basis_points;
  if(row.mode==="percentage"){
   if(!Number.isInteger(basis)||basis<0||basis>10000||Number((BigInt(total)*BigInt(basis)+5000n)/10000n)!==next)
     return label+" has inconsistent percentage.";
  }else if(basis!==null)return label+" has unexpected percentage.";
  const defer=row.mode==="schedule-before-deposit";
  if(row.schedule_before_collection!==(defer?1:0)||(defer&&next!==old))return label+" has inconsistent collection deferral.";
  if(row.mode==="waive"&&next!==0)return label+" has invalid waiver.";
  if(["standard","restore-standard"].includes(row.mode)&&next!==Number((BigInt(total)+1n)/2n))return label+" has invalid standard terms.";
  if(![0,1].includes(row.requires_customer_reapproval))return label+" has invalid agreement revision flag.";
  const signed=row.previous_signed_at!==null;
  if(row.requires_customer_reapproval!==(signed&&(old!==next||defer)?1:0))return label+" has inconsistent agreement revision.";
  for(const key of ["previous_contract_version","updated_contract_version","previous_signed_at","reason"])
   if(row[key]!==null&&typeof row[key]!=="string")return label+" has invalid "+key+".";
  if(row.reason!==null&&row.reason.length>500)return label+" has an oversized reason.";
  if(typeof row.created_at!=="string"||!Number.isFinite(Date.parse(row.created_at)))return label+" has invalid timestamp.";
 }
 return null;
}
export function depositAuditRowsConflict(existing,incoming){
 return DEPOSIT_AUDIT_COLUMNS.some(column=>existing?.[column]!==incoming?.[column]);
}
