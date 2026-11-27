// Pure activation-ready binding planner. No provider calls, secrets, or writes.
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {verifyInactiveBindings} from './owner_staging_beta_private_fourth.mjs';
export const SOURCE_VERSION='25608398-d0f6-4607-afd3-c4918ab52253';
const need=(ok,code)=>{if(!ok)throw Error('STAGING_ACTIVATION_PLAN_STOP_'+code)};
export function planActivationBindings(version,serving){
 need(version?.id===SOURCE_VERSION,'SOURCE_VERSION');
 need(serving?.workerId===PIN.workerId&&serving.deployment===PIN.deployment&&serving.version===PIN.version&&serving.percentage===100,'SERVING');
 need(verifyInactiveBindings(version),'SOURCE_BINDINGS');
 return [
 {name:'DB',type:'d1',id:PIN.db},
 ...['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH'].map(name=>({name,type:'inherit',version_id:SOURCE_VERSION})),
 {name:'FIRE_ENV',type:'plain_text',text:'staging'},
 {name:'SITE_ORIGIN',type:'plain_text',text:'https://fire-app-independent-staging.kyle-bfc.workers.dev'},
 {name:'FIRE_STAGING_PRIVATE_ACTIVATION',type:'plain_text',text:'owner-approved'},
 {name:'FIRE_STRIPE_MODE',type:'plain_text',text:'disabled'}
 ];
}
export function verifyActivationReadyBindings(version){
 const b=version?.resources?.bindings;
 need(Array.isArray(b),'READBACK');
 const flag=b.find(x=>x?.name==='FIRE_STAGING_PRIVATE_ACTIVATION');
 need(flag?.type==='plain_text'&&flag.text==='owner-approved','FLAG');
 return verifyInactiveBindings({...version,resources:{...version.resources,bindings:b.map(x=>x===flag?{...x,text:'blocked'}:x)}});
}
