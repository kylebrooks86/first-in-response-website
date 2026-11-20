/** Native source-only FIRE complete records property/location preflight.
 * Verify the three supported optional tables are logically paired with the
 * same immutable customer/estimate history BEFORE encrypting or restoring.
 * No database, files, R2, Cloudflare, payment or actual business records.
 */
import assert from 'node:assert/strict';
import {validateCompleteSupplementalCustomerHistory}
 from './validate_supplemental_customer_history.mjs';
const date='2026-11-15T12:00:00.000Z',created='2026-11-14T12:00:00.000Z';
let checks=0;
const yes=(v,desc)=>{assert.ok(v,desc);checks++};
const reject=(c,s,desc)=>{assert.throws(()=>validateCompleteSupplementalCustomerHistory(c,s),/BLOCKED:/,desc);checks++};
const copy=x=>structuredClone(x);
const customer='synthetic-customer-001',estimate='synthetic-estimate-001',pid='synthetic-property-001';
const core={tables:{
 customers:[{id:customer,name:'Synthetic FIRE',address:'123 Synthetic Drive'}],
 estimates:[{id:estimate,customer_id:customer,status:'draft'}]
}};
const location={
 estimate_id:estimate,customer_id:customer,address:'123 Synthetic Drive · East driveway',
 captured_at:date
};
const property={
 id:pid,customer_id:customer,address:'123 Synthetic Drive',
 designation:'East driveway',active:1,revision:1,created_at:created
};
const link={
 estimate_id:estimate,customer_id:customer,property_id:pid,property_revision:1,
 selection_mode:'explicit',captured_at:date
};
const without={tables:{}};
const service={tables:{estimate_service_locations:[location]}};
const propertyTriple={tables:{
 estimate_service_locations:[location],customer_properties:[property],
 estimate_property_links:[link],property_recovery_guard:[]
}};
const base=validateCompleteSupplementalCustomerHistory(core,without);
yes(base.candidateFeatureTablesPresent===false&&base.gate7Accepted===false&&
 base.supplementalSchemaCompleteVerified===false,
 'Base 23-table recovery remains source-only with no optional property claims');
const stand=validateCompleteSupplementalCustomerHistory(core,service);
yes(stand.knownLocationRows===1&&stand.knownProperties===0&&stand.gate7Accepted===false,
 'Single reviewed immutable service snapshot pairs with existing customer job');
const complete=validateCompleteSupplementalCustomerHistory(core,propertyTriple);
yes(complete.knownLocationRows===1&&complete.knownProperties===1&&
 complete.knownPropertyLinks===1&&complete.gate7Accepted===false,
 'True property + immutable selected estimate + historical service address validated');
const previous=JSON.stringify({core,propertyTriple});
const negatives=[
 ['Missing all service addresses',{tables:{customer_properties:[property],estimate_property_links:[link]}}],
 ['Missing native property recovery guard',{tables:{estimate_service_locations:[location],
  customer_properties:[property],estimate_property_links:[link]}}],
 ['Temporary property recovery guard was left occupied',{tables:{...propertyTriple.tables,
  property_recovery_guard:[{id:1}]}}],
 ['Orphan property table',{tables:{estimate_service_locations:[location],customer_properties:[property]}}],
 ['Orphan property link table',{tables:{estimate_service_locations:[location],estimate_property_links:[link]}}],
 ['Wrong customer service address', {tables:{...propertyTriple.tables,
  estimate_service_locations:[{...location,customer_id:'synthetic-other-customer'}]}}],
 ['Service address linked to another estimate',{tables:{...propertyTriple.tables,
  estimate_service_locations:[{...location,estimate_id:'synthetic-other-job'}]}}],
 ['Untrusted historical captured address',{tables:{...propertyTriple.tables,
  estimate_service_locations:[{...location,address:'Unrecognized job address'}]}}],
 ['Changed property owner',{tables:{...propertyTriple.tables,
  customer_properties:[{...property,customer_id:'synthetic-other-customer'}]}}],
 ['Changed link owner',{tables:{...propertyTriple.tables,
  estimate_property_links:[{...link,customer_id:'synthetic-other-customer'}]}}],
 ['Link to nonexistent property',{tables:{...propertyTriple.tables,
  estimate_property_links:[{...link,property_id:'other'}]}}],
 ['Changed immutable property revision',{tables:{...propertyTriple.tables,
  estimate_property_links:[{...link,property_revision:3}]}}],
 ['Changed capture time from original',{tables:{...propertyTriple.tables,
  estimate_property_links:[{...link,captured_at:created}]}}],
 ['Forbidden mutable property lifecycle',{tables:{...propertyTriple.tables,
  customer_properties:[{...property,revision:99}]}}],
 ['Duplicate service snapshots',{tables:{...propertyTriple.tables,
  estimate_service_locations:[location,location]}}],
 ['Duplicate immutable property identity',{tables:{...propertyTriple.tables,
  customer_properties:[property,property]}}],
 ['Customer table duplicated as supplemental',{tables:{...propertyTriple.tables,customers:[]}}],
 ['Service location missing exact required column',{tables:{...propertyTriple.tables,
  estimate_service_locations:[{estimate_id:estimate,customer_id:customer,address:location.address}]}}],
 ['Unexpected property column would be silently omitted',{tables:{...propertyTriple.tables,
  customer_properties:[{...property,extra:'do not ignore'}]}}],
 ['Service photo-history cannot stand in for property identity',{tables:{...propertyTriple.tables,
  customer_properties:[{...property,created_at:'invalid'}]}}],
 ['Truncated property list is not a valid table',{tables:{...propertyTriple.tables,customer_properties:null}}],
 ['Core customer inventory omitted',{tables:{estimates:core.tables.estimates}}]
];
for(const [description,bad] of negatives)reject(core,bad,description);
reject({tables:{customers:[],estimates:[]}},propertyTriple,
 'Cross-record relationship cannot be accepted without original customer/estimate');
yes(JSON.stringify({core,propertyTriple})===previous,
 'All positive and negative tests preserved original synthetic records');
const archived=copy(propertyTriple);
archived.tables.customer_properties[0].active=0;
archived.tables.customer_properties[0].revision=2;
const history=validateCompleteSupplementalCustomerHistory(core,archived);
yes(history.knownPropertyLinks===1,
 'Historically selected estimate retains property link after legitimate archival');
yes(!history.photoBytesRestored&&!history.remoteWritesPerformed&&!history.gate7Accepted,
 'No offline property validation claims photos or Cloudflare deployment evidence');
console.log('PASS '+checks+'/'+checks+' exact supplemental property/service-location source-only history cases.');
