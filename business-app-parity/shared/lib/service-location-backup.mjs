const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function serviceLocationManifest(rows){return {version:1,estimateIds:rows.map(row=>row.estimate_id).sort()};}
// This additive v1 extension never infers historical addresses from customer data.
export function serviceLocationBackupError(payload,tables){
 const rows=tables.estimate_service_locations,manifest=payload.serviceLocationSnapshots;
 const declared=record(payload.includes)&&payload.includes.serviceAddressSnapshots===true;
 if(rows===undefined&&manifest===undefined&&!declared)return null; // Genuine legacy backup.
 if(!declared||!record(manifest)||manifest.version!==1||!Array.isArray(rows)||!Array.isArray(manifest.estimateIds))return 'Service-address snapshot coverage is missing or invalid.';
 const owners=new Map((Array.isArray(tables.estimates)?tables.estimates:[]).filter(record).map(row=>[row.id,row.customer_id]));
 const customers=new Set((Array.isArray(tables.customers)?tables.customers:[]).filter(record).map(row=>row.id));
 const seen=new Set();
 for(const row of rows){
  if(!record(row)||Object.keys(row).sort().join(',')!=='address,captured_at,customer_id,estimate_id')return 'Invalid service-address snapshot fields.';
  if(typeof row.estimate_id!=='string'||!row.estimate_id||row.estimate_id.length>128||seen.has(row.estimate_id))return 'Duplicate or invalid snapshot estimate identity.';
  seen.add(row.estimate_id);
  if(typeof row.customer_id!=='string'||!customers.has(row.customer_id)||owners.get(row.estimate_id)!==row.customer_id)return 'Snapshot customer/estimate ownership mismatch.';
  if(typeof row.address!=='string'||row.address.length>2000||typeof row.captured_at!=='string'||!Number.isFinite(Date.parse(row.captured_at))||new Date(row.captured_at).toISOString()!==row.captured_at)return 'Invalid captured service address or timestamp.';
 }
 const identities=manifest.estimateIds;
 if(identities.some(id=>typeof id!=='string')||new Set(identities).size!==identities.length||identities.length!==seen.size||identities.some(id=>!seen.has(id)))return 'Service-address snapshot coverage does not match the backup rows.';
 return null;
}
