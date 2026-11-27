import {serviceLocationsEnabled} from './service-location';
export function customerPropertiesEnabled(env:{FIRE_CUSTOMER_PROPERTIES_CANDIDATE?:string;FIRE_SERVICE_LOCATIONS_CANDIDATE?:string}) {
  return serviceLocationsEnabled(env)&&env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE==='synthetic-only';
}
export type CustomerProperty={id:string;customerId:string;address:string;designation:string;active:number;revision:number;createdAt:string};
export function propertyEstimatesTestEnabled(env:{FIRE_CUSTOMER_PROPERTIES_CANDIDATE?:string;FIRE_SERVICE_LOCATIONS_CANDIDATE?:string;FIRE_PROPERTY_ESTIMATES_CANDIDATE?:string}){
 return customerPropertiesEnabled(env)&&env.FIRE_PROPERTY_ESTIMATES_CANDIDATE==='synthetic-tests-only';
}
export class PropertySelectionError extends Error{}
export async function selectEstimateProperty(db:D1Database,customerId:string,propertyId:unknown,revision:unknown,selectionMode:unknown='explicit'){
 if(!['sole','explicit'].includes(String(selectionMode)))throw new PropertySelectionError('Invalid property selection mode.');
 if(propertyId!==undefined&&(typeof propertyId!=='string'||!propertyId||propertyId.length>128||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1))throw new PropertySelectionError('Select a property with its current revision.');
 const result=await db.prepare('SELECT id,customer_id AS customerId,address,designation,active,revision,created_at AS createdAt FROM customer_properties WHERE customer_id=? AND active=1 ORDER BY id LIMIT 2').bind(customerId).all<CustomerProperty>();
 if(propertyId!==undefined){const row=await db.prepare('SELECT id,customer_id AS customerId,address,designation,active,revision,created_at AS createdAt FROM customer_properties WHERE id=? AND customer_id=? AND active=1 AND revision=?').bind(propertyId,customerId,revision).first<CustomerProperty>();if(!row)throw new PropertySelectionError('Property ownership, activity or revision does not match.');if(selectionMode==='sole'&&(result.results.length!==1||result.results[0].id!==row.id))throw new PropertySelectionError('Active properties changed. Select the property explicitly.');return {property:row,mode:selectionMode==='sole'?'sole' as const:'explicit' as const};}
 if(result.results.length>1)throw new PropertySelectionError('Multiple active properties require an explicit selection.');
 if(result.results.length===1)return {property:result.results[0],mode:'sole' as const};
 const retained=await db.prepare('SELECT COUNT(*) AS total FROM customer_properties WHERE customer_id=?').bind(customerId).first<{total:number}>();
 if(Number(retained?.total)>0)throw new PropertySelectionError('There is no active property for this customer.');
 return null;
}
export function propertyAssociationColumns(enabled:boolean){return enabled?",(SELECT pl.property_id FROM estimate_property_links pl WHERE pl.estimate_id=e.id AND pl.customer_id=e.customer_id) AS propertyId,(SELECT pl.property_revision FROM estimate_property_links pl WHERE pl.estimate_id=e.id AND pl.customer_id=e.customer_id) AS propertyRevision":'';}

export type PropertyEstimateSelection={property:CustomerProperty;mode:'sole'|'explicit'};
export function propertyWorkflowTestEnabled(env:{FIRE_CUSTOMER_PROPERTIES_CANDIDATE?:string;FIRE_SERVICE_LOCATIONS_CANDIDATE?:string;FIRE_PROPERTY_ESTIMATES_CANDIDATE?:string;FIRE_PROPERTY_RECOVERY_CANDIDATE?:string;FIRE_PROPERTY_WORKFLOW_CANDIDATE?:string}){return propertyEstimatesTestEnabled(env)&&env.FIRE_PROPERTY_RECOVERY_CANDIDATE==='synthetic-tests-only'&&env.FIRE_PROPERTY_WORKFLOW_CANDIDATE==='synthetic-tests-only';}
