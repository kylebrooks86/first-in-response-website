import {serviceLocationsEnabled} from './service-location';
export function customerPropertiesEnabled(env:{FIRE_CUSTOMER_PROPERTIES_CANDIDATE?:string;FIRE_SERVICE_LOCATIONS_CANDIDATE?:string}) {
  return serviceLocationsEnabled(env)&&env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE==='synthetic-only';
}
export type CustomerProperty={id:string;customerId:string;address:string;designation:string;active:number;revision:number;createdAt:string};
