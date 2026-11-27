/** FIRE source-only complete-record/property/service-location relationship seal.
 *
 * The complete SQLite exporter already inventories ALL tables and their schema,
 * but an in-range, schema-shaped archive may still link an estimate to another
 * customer's property or a different captured service address. Use the
 * existing immutable property/service backup contracts BEFORE sealing or
 * restoring any encrypted snapshot. No SQL, provider, R2 or filesystem writes.
 *
 * This does not mean customer photos or their bytes were recovered.
 */
import {serviceLocationBackupError,serviceLocationManifest}
 from './service-location-backup.mjs';
import {propertyBackupError,propertyBackupManifest}
 from './property-backup.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES}
 from './numbered-records-v2-preflight.mjs';

const stop=why=>{throw Error('FIRE complete supplemental customer history BLOCKED: '+why);};
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const names=new Set([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
const service='estimate_service_locations',properties='customer_properties',links='estimate_property_links';
const guard='property_recovery_guard';

/** Independent, read-only preflight for the exact existing core+supplemental
 * snapshot. Known supplemental property/location tables must all be present
 * together when used, with immutable same-customer and address associations.
 * Unknown supplemental tables remain governed by the isolated schema hash,
 * all-column restore contract and SQLite foreign keys; NEVER claim full Gate7.
 */
export function validateCompleteSupplementalCustomerHistory(core,supplemental){
 if(!record(core)||!record(core.tables)||!record(supplemental)||!record(supplemental.tables))
  stop('complete core and supplemental table inventories required');
 const c=core.tables,s=supplemental.tables;
 if(Object.keys(s).some(k=>names.has(k)))stop('core table duplicated in supplemental snapshot');
 const anyLocation=own(s,service),anyProperty=own(s,properties),anyLink=own(s,links);
 // The real property migration supplies a one-row, EMPTY-DESTINATION-only
 // native guard. Never archive or replay a live temporary guard row; doing
 // so would bypass historical property triggers on the destination.
 const hasGuard=own(s,guard);
 if(hasGuard&&(!Array.isArray(s[guard])||s[guard].length!==0))
  stop('a temporary property recovery guard cannot be backed up as business data');
 if((anyProperty||anyLink)&&!hasGuard)
  stop('property recovery requires its exact empty native one-shot guard table');
 if(anyProperty!==anyLink||((anyProperty||anyLink)&&!anyLocation))
  stop('property history requires property, immutable link, and service-address tables together');
 if(!anyLocation)
  return Object.freeze({knownLocationRows:0,knownProperties:0,
   knownPropertyLinks:0,candidateFeatureTablesPresent:false,
   supplementalSchemaCompleteVerified:false,photoBytesRestored:false,
   remoteWritesPerformed:false,gate7Accepted:false});
 if(!Array.isArray(s[service])||
    (anyProperty&&(!Array.isArray(s[properties])||!Array.isArray(s[links]))))
  stop('supplemental property or service-address rows are truncated');
 if(!Array.isArray(c.customers)||!Array.isArray(c.estimates))
  stop('complete customer and estimate inventory required');
 // Reuse existing exact SQL source schemas' validators; do not create a
 // weaker fork of the lifecycle, immutable captured address and owner rules.
 const tables={...c,...s};
 const payload={
  includes:{serviceAddressSnapshots:true,customerProperties:anyProperty},
  serviceLocationSnapshots:serviceLocationManifest(s[service]),
  ...(anyProperty?{customerProperties:propertyBackupManifest(s[properties],s[links])}:{})
 };
 let error;
 try{
  error=anyProperty?propertyBackupError(payload,tables):
   serviceLocationBackupError(payload,tables);
 }catch{stop('supplemental relationship fields could not be validated');}
 if(error)stop(error);
 return Object.freeze({
  knownLocationRows:s[service].length,knownProperties:anyProperty?s[properties].length:0,
  knownPropertyLinks:anyProperty?s[links].length:0,
  candidateFeatureTablesPresent:true,supplementalSchemaCompleteVerified:false,
  photoBytesRestored:false,remoteWritesPerformed:false,gate7Accepted:false
 });
}
