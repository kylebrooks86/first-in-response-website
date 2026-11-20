import {serviceLocationBackupError} from './service-location-backup.mjs';
const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const identity=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=128;
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fields=(row,names)=>record(row)&&Object.keys(row).sort().join(',')===names.sort().join(',');
const coverage=(ids,seen)=>Array.isArray(ids)&&ids.every(identity)&&new Set(ids).size===ids.length&&ids.length===seen.size&&ids.every(id=>seen.has(id));
export function propertyBackupManifest(properties,links){
 return {version:1,propertyIds:properties.map(row=>row.id).sort(),estimateIds:links.map(row=>row.estimate_id).sort()};
}
// Validate retained history, never infer a property for an unlinked historical estimate.
export function propertyBackupError(payload,tables){
 const properties=tables.customer_properties,links=tables.estimate_property_links,manifest=payload.customerProperties;
 const declared=record(payload.includes)&&payload.includes.customerProperties===true;
 if(properties===undefined&&links===undefined&&manifest===undefined&&!declared)return null;
 if(!declared||!record(manifest)||manifest.version!==1||!Array.isArray(properties)||!Array.isArray(links))return 'Property backup coverage is missing or invalid.';
 if(!Array.isArray(tables.customers)||!Array.isArray(tables.estimates))return 'Property backup requires complete customer and estimate records.';
 const locationError=serviceLocationBackupError(payload,tables);
 if(locationError)return locationError;
 if(!Array.isArray(tables.estimate_service_locations))return 'Property backup requires declared service-address snapshots.';
 const customers=new Set(tables.customers.filter(record).map(row=>row.id));
 const estimates=new Map(tables.estimates.filter(record).map(row=>[row.id,row]));
 const snapshots=new Map(tables.estimate_service_locations.map(row=>[row.estimate_id,row]));
 const byId=new Map(),seenLinks=new Set();
 for(const row of properties){
  if(!fields(row,['id','customer_id','address','designation','active','revision','created_at']))return 'Invalid property record fields.';
  if(!identity(row.id)||byId.has(row.id))return 'Duplicate or invalid property identity.';
  if(!identity(row.customer_id)||!customers.has(row.customer_id))return 'Property customer ownership is invalid.';
  if(typeof row.address!=='string'||!row.address.trim()||row.address.length>2000||typeof row.designation!=='string'||row.designation.length>200)return 'Invalid property address or designation.';
  // The current schema permits creation at revision 1 and one irreversible archive at 2.
  if(!((row.active===1&&row.revision===1)||(row.active===0&&row.revision===2))||!timestamp(row.created_at))return 'Invalid property lifecycle or creation timestamp.';
  byId.set(row.id,row);
 }
 for(const row of links){
  if(!fields(row,['estimate_id','customer_id','property_id','property_revision','selection_mode','captured_at']))return 'Invalid historical property link fields.';
  if(!identity(row.estimate_id)||seenLinks.has(row.estimate_id))return 'Duplicate or invalid property-link estimate identity.';
  const property=byId.get(row.property_id),estimate=estimates.get(row.estimate_id),snapshot=snapshots.get(row.estimate_id);
  if(!property||!estimate||!snapshot||row.customer_id!==property.customer_id||row.customer_id!==estimate.customer_id||row.customer_id!==snapshot.customer_id)return 'Property-link customer/estimate ownership mismatch.';
  if(row.property_revision!==1||!['sole','explicit'].includes(row.selection_mode)||!timestamp(row.captured_at)||row.captured_at<property.created_at)return 'Invalid historical property selection or timestamp.';
  const address=property.address+(property.designation?' · '+property.designation:'');
  if(snapshot.address!==address||snapshot.captured_at!==row.captured_at)return 'Property link does not match its immutable service-address snapshot.';
  // Do not re-evaluate historical sole selection against today's active property count.
  seenLinks.add(row.estimate_id);
 }
 if(!coverage(manifest.propertyIds,new Set(byId.keys()))||!coverage(manifest.estimateIds,seenLinks))return 'Property backup coverage does not match retained records and links.';
 return null;
}

export function hasPropertyBackup(payload,tables){
 return Object.hasOwn(tables,'customer_properties')||Object.hasOwn(tables,'estimate_property_links')||Object.hasOwn(payload,'customerProperties')||(record(payload.includes)&&Object.hasOwn(payload.includes,'customerProperties'));
}
