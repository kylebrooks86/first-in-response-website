// Pure, offline STAGING beta API binding contract. No fetch, credentials from disk,
// upload, activation or asset mutation. Caller must separately verify serving traffic.
export const PIN=Object.freeze({worker:'fire-app-independent-staging',workerId:'34478b20ffef45138ec3b41fa578ec5b',version:'7838d0ea-be89-49c6-9984-d3b021082d72',deployment:'10215e59-2ff0-485c-92f6-11d7f0405060',db:'afb2c05a-d794-4a9a-b580-924ce01c26ad'});
const need=(ok)=>{if(!ok)throw Error('STAGING_BINDING_CONTRACT_STOP')};
export function buildStagingBindings({workerId,serving,predecessor,adminHash}={}){
 need(workerId===PIN.workerId&&serving?.deployment===PIN.deployment&&serving?.version===PIN.version&&serving?.percentage===100);
 need(predecessor?.id===PIN.version&&Array.isArray(predecessor.resources?.bindings));
 const b=predecessor.resources.bindings;
 need(b.length===3&&new Set(b.map(x=>x?.name)).size===3);
 const db=b.find(x=>x?.name==='DB');
 need(db?.type==='d1'&&(db.database_id??db.id)===PIN.db&&(!('database_id'in db)||!('id'in db)||db.id===db.database_id));
 for(const name of ['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY']){
  const entry=b.find(x=>x?.name===name);
  need(entry?.type==='secret_text'&&!Object.hasOwn(entry,'text')&&!Object.hasOwn(entry,'value'));
 }
 need(typeof adminHash==='string'&&/^[a-f0-9]{64}$/.test(adminHash));
 return [
  ...['DB','FIRE_SESSION_SECRET','STRIPE_SECRET_KEY'].map(name=>({name,type:'inherit',version_id:PIN.version})),
  {name:'FIRE_ENV',type:'plain_text',text:'staging'},
  {name:'FIRE_STRIPE_MODE',type:'plain_text',text:'disabled'},
  {name:'FIRE_ADMIN_PASSWORD_HASH',type:'secret_text',text:adminHash}
 ];
}
// Deliberately no version body or HTTP transport until static asset contract is sealed.
