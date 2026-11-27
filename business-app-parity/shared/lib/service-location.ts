/** Candidate-only snapshot support. All SQL fragments below are fixed developer constants. */
export function serviceLocationsEnabled(env:{FIRE_SERVICE_LOCATIONS_CANDIDATE?:string}){return env.FIRE_SERVICE_LOCATIONS_CANDIDATE==="synthetic-only";}
export function serviceAddressSql(enabled:boolean,currentAddress="c.address"){
 return enabled?`COALESCE((SELECT sl.address FROM estimate_service_locations sl WHERE sl.estimate_id=e.id AND sl.customer_id=e.customer_id),${currentAddress})`:currentAddress;
}
export function serviceAddressColumns(enabled:boolean,currentAddress="c.address"){
 return serviceAddressSql(enabled,currentAddress)+" AS address"+(enabled?",CASE WHEN EXISTS(SELECT 1 FROM estimate_service_locations sl WHERE sl.estimate_id=e.id AND sl.customer_id=e.customer_id) THEN 'captured' ELSE 'legacy-current-unverified' END AS serviceAddressSource":"");
}
