/** Actual candidate-only customer property POST + original SQLite triggers; no hosted D1 writes. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db;
rt.env.FIRE_SERVICE_LOCATIONS_CANDIDATE='synthetic-only';
rt.env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE='synthetic-only';
db.exec(readFileSync('db/candidate-service-locations.sql','utf8'));
db.exec(readFileSync('db/candidate-customer-properties.sql','utf8'));
const route=rt.load('app/api/customer-properties/route.ts');
const now='2026-11-16T20:00:00.000Z';
for(const customer of ['owner-property-a','owner-property-b'])
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(customer,'Synthetic '+customer,now);
const id=n=>'ab123456-1234-4234-8234-'+String(n).padStart(12,'0');
const base={customerId:'owner-property-a',address:'100 Real Owner Synthetic Street',designation:'Front building',operationId:id(1)};
const post=async value=>{
 const response=await route.POST(new Request('https://synthetic.invalid/api/customer-properties',{method:'POST',body:JSON.stringify(value)}));
 checkResponsePrivacy(response,'owner property mutation');
 return {status:response.status,body:await response.json()};
};
const raw=body=>new Request('https://synthetic.invalid/api/customer-properties',{method:'POST',body});
const patch=async value=>{
 const response=await route.PATCH(new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:JSON.stringify(value)}));
 checkResponsePrivacy(response,'owner property mutation');
 return {status:response.status,body:await response.json()};
};
const stored=key=>db.prepare('SELECT * FROM customer_properties WHERE id=?').get(key)??null;
const n=()=>db.prepare('SELECT COUNT(*) AS n FROM customer_properties').get().n;
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const checkResponsePrivacy=(response,label)=>{
 eq(response.headers.get('cache-control'),'private, no-store',label+' is never shared/cached');
 eq(response.headers.get('vary'),'Cookie',label+' varies by owner session');
 eq(response.headers.get('x-content-type-options'),'nosniff',label+' refuses MIME sniffing');
};
const old=rt.env.DB.prepare;
try{
 for(const [label,request,expected] of [
  ['claimed oversized',new Request('https://synthetic.invalid/api/customer-properties',{method:'POST',body:'{}',headers:{'content-length':'8193'}}),413],
  ['observed oversized',raw(' '.repeat(8193)),413],
  ['contradicted declared length',new Request('https://synthetic.invalid/api/customer-properties',{method:'POST',body:'{"x":1}',headers:{'content-length':'2'}}),400],
  ['invalid UTF8',raw(new Uint8Array([123,34,120,34,58,255,125])),400],
  ['JSON array',raw('[]'),400],
 ]){
  const before=rt.counters();
  const response=await route.POST(request);
  eq(response.status,expected,label+' refused before query');
  checkResponsePrivacy(response,label+' POST rejection');
  eq(rt.counters(),before,label+' performs no D1 reads or writes');
 }
 let result=await post(base);
 eq(result.status,201,'Owner creates once with exact operation UUID');
 eq(result.body.property.id,base.operationId,'Server stores caller operation ID as immutable property ID');
 eq(stored(id(1)).customer_id,base.customerId,'Native SQLite retained right owner');
 eq(n(),1,'Only one record exists');
 // GET exposes saved private service addresses and ownership metadata.
 // A response must not remain in a shared proxy/browser cache, even on 401.
 const ownerList=await route.GET(new Request('https://synthetic.invalid/api/customer-properties?customerId=owner-property-a&limit=50'));
 const ownerPage=await ownerList.json();
 eq(ownerList.status,200,'Owner property inventory still loads normally');
 eq(ownerList.headers.get('cache-control'),'private, no-store','Customer address response never publicly cached');
 eq(ownerList.headers.get('vary'),'Cookie','Customer address responses vary with owner session');
 eq(ownerList.headers.get('x-content-type-options'),'nosniff','Property data is not MIME-sniffed');
 eq(ownerPage.properties[0].id,base.operationId,'Private response retains exact owner property');
 const foreignList=await route.GET(new Request('https://synthetic.invalid/api/customer-properties?customerId=owner-property-b&selectedPropertyId='+base.operationId));
 const foreignPage=await foreignList.json();
 eq(foreignList.status,200,'Different synthetic customer property listing loads');
 eq(foreignPage.properties.length,0,'Different customer property list contains no first-customer address');
 eq(foreignPage.selectedProperty,null,'Cross-customer selected property cannot leak original address');

 const original=stored(id(1));
 result=await post(base);
 eq(result.status,200,'Identical HTTP replay safely returns original row');
 eq(result.body.property.createdAt,original.created_at,'Replay retains immutable original creation time');
 eq(n(),1,'Repeated save is not another property');
 eq(await post({...base,address:'Changed address'}).then(x=>x.status),409,'Same operation ID cannot mutate saved address');
 eq(await post({...base,customerId:'owner-property-b'}).then(x=>x.status),409,'Same operation ID cannot cross customers');
 eq(stored(id(1)),original,'Conflicting attempts preserve the physical immutable row');
 eq((await post({...base,operationId:'not-a-v4-uuid'})).status,400,'Invalid operation ID refused');
 eq((await post({...base,unexpected:true})).status,400,'Unknown owner input refused');
 eq((await post({...base,operationId:id(2),customerId:'missing-customer'})).status,404,'Missing customer cannot create a property');
 eq(n(),1,'Invalid/missing-customer attempts leave history unchanged');
 // The real INSERT commits on native SQLite, but the D1 acknowledgement is
 // lost before .first() returns. Reconcile the exact operation ID with readback.
 let disrupted=false;
 rt.env.DB.prepare=function(sql){
  const statement=old(sql);
  if(sql.startsWith('INSERT INTO customer_properties')&&!disrupted){
   return {...statement,bind(...args){
    const op=statement.bind(...args);
    return {...op,async first(){const row=await op.first();disrupted=true;throw Error('Synthetic D1 INSERT ACK lost after physical commit');}};
   }};
  }
  return statement;
 };
 result=await post({...base,operationId:id(3),address:'200 Stable New Address'});
 eq(disrupted,true,'SQLite commit really occurred before acknowledgement loss');
 eq(result.status,200,'Committed-but-lost INSERT ACK recovered without retry');
 eq(result.body.recoveredAfterUncertainSave,true,'Owner sees recovered confirmed status');
 eq(stored(id(3)).address,'200 Stable New Address','Recovered record physically exists');
 rt.env.DB.prepare=old;
 eq((await post({...base,operationId:id(3),address:'200 Stable New Address'})).status,200,'Retry reads original property');
 eq(n(),2,'Only two physically distinct owner properties exist');
 // False provider SUCCESS without a database row cannot create fabricated
 // confirmation, even when a RETURNING-shaped row was supplied.
 rt.env.DB.prepare=function(sql){
  const statement=old(sql);
  if(sql.startsWith('INSERT INTO customer_properties')){
   return {...statement,bind(){return {first:async()=>({id:id(4),customerId:base.customerId,address:'Fake inserted',designation:base.designation,active:1,revision:1,createdAt:now})};}};
  }
  return statement;
 };
 result=await post({...base,operationId:id(4),address:'Fake inserted'});
 eq(result.status,503,'Fake successful INSERT ACK without persisted record fails closed');
 eq(result.body.saveUncertain,true,'Owner receives uncertainty rather than fabricated success');
 eq(stored(id(4)),null,'No fabricated property written');
 rt.env.DB.prepare=old;
 // Backward compatible clients without operation UUID retain normal first
 // create support, but new owner UI supplies a stable ID for retries.
 result=await post({customerId:base.customerId,address:'Legacy address',designation:''});
 eq(result.status,201,'Existing old property client remains compatible');
 eq(typeof result.body.property.id,'string','Server generates legacy ID if caller omitted operation UUID');
 eq(n(),3,'All native SQLite property records preserved');
 // Archive is a separate immutable revision write. A lost ACK must never
 // make the UI claim a failed archive that was physically committed.
 const archiveBase={customerId:base.customerId,propertyId:id(1),action:'archive',expectedRevision:1};
 for(const [label,request,expected] of [
  ['PATCH declared oversized',new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:'{}',headers:{'content-length':'8193'}}),413],
  ['PATCH streamed oversized',new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:' '.repeat(8193)}),413],
  ['PATCH contradictory length',new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:'{"x":1}',headers:{'content-length':'2'}}),400],
  ['PATCH invalid UTF8',new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:new Uint8Array([123,34,120,34,58,255,125])}),400],
  ['PATCH JSON array',new Request('https://synthetic.invalid/api/customer-properties',{method:'PATCH',body:'[]'}),400],
 ]){
  const before=rt.counters();
  const response=await route.PATCH(request);
  eq(response.status,expected,label+' rejected before D1 access');
  checkResponsePrivacy(response,label+' PATCH rejection');
  eq(rt.counters(),before,label+' does not touch D1');
 }
 let archived=await patch(archiveBase);
 eq(archived.status,200,'New archive confirms exact persisted revision');
 eq(archived.body.property.active,0,'Stored property archived, not deleted');
 eq(archived.body.property.revision,2,'Native property revision advances exactly once');
 eq(stored(id(1)).revision,2,'Physical SQLite revision matches archive receipt');
 eq(stored(id(1)).address,original.address,'Archived address and history remain immutable');
 archived=await patch(archiveBase);
 eq(archived.status,200,'Deliberate archive replay recognizes prior saved state');
 eq(archived.body.recoveredAfterUncertainSave,true,'Replay does not claim another archive');
 eq(stored(id(1)).revision,2,'Same archive operation never increases revision twice');
 eq((await patch({...archiveBase,customerId:'owner-property-b'})).status,409,'Foreign customer cannot replay archive');
 eq((await patch({...archiveBase,expectedRevision:2})).status,409,'Cannot archive already archived record at wrong revision');
 eq((await patch({...archiveBase,unexpected:true})).status,400,'Unknown PATCH keys refused');
 eq((await patch({...archiveBase,expectedRevision:'1'})).status,400,'Noninteger PATCH revision refused');

 // D1 executes the UPDATE and *then* throws, simulating a real lost ACK.
 let archiveLostAck=false;
 rt.env.DB.prepare=function(sql){
  const statement=old(sql);
  if(sql.startsWith('UPDATE customer_properties')&&!archiveLostAck){
   return {...statement,bind(...args){
    const op=statement.bind(...args);
    return {...op,async first(){await op.first();archiveLostAck=true;throw Error('D1 archive ACK lost AFTER SQL commit');}};
   }};
  }
  return statement;
 };
 archived=await patch({...archiveBase,propertyId:id(3)});
 eq(archiveLostAck,true,'Native archive really committed before ACK was lost');
 eq(archived.status,200,'Lost archive ACK recovers from actual D1 readback');
 eq(archived.body.recoveredAfterUncertainSave,true,'Owner sees truthful recovered archive receipt');
 eq(stored(id(3)).active,0,'Recovered archive actually persisted');
 eq(stored(id(3)).revision,2,'Recovered archive revision increments once');
 rt.env.DB.prepare=old;
 eq((await patch({...archiveBase,propertyId:id(3)})).status,200,'Later identical retry recovers archived state');
 eq(stored(id(3)).revision,2,'Later retry does not archive twice');

 // A forged UPDATE RETURNING response without physical commit must NOT count.
 const legacy=db.prepare("SELECT id FROM customer_properties WHERE address='Legacy address'").get().id;
 const priorLegacy=stored(legacy);
 rt.env.DB.prepare=function(sql){
  const statement=old(sql);
  if(sql.startsWith('UPDATE customer_properties')){
   return {...statement,bind(){return {first:async()=>({id:legacy,customerId:base.customerId,address:'Legacy address',designation:'',active:0,revision:2,createdAt:now})};}};
  }
  return statement;
 };
 archived=await patch({...archiveBase,propertyId:legacy});
 eq(archived.status,503,'False positive UPDATE ACK fails closed');
 eq(archived.body.saveUncertain,true,'Owner receives uncertainty on false ACK');
 eq(stored(legacy),priorLegacy,'Fake archive receipt does not alter saved record');
 rt.env.DB.prepare=old;

 // Commit succeeds but a later SELECT fails. Never claim archive success
 // unless the independent readback is available; deliberate retry can recover.
 let blockRead=true;
 rt.env.DB.prepare=function(sql){
  const statement=old(sql);
  if(sql.startsWith('SELECT id,customer_id AS customerId,address,designation,active,revision,created_at AS createdAt FROM customer_properties WHERE id=? AND customer_id=?')&&blockRead){
   return {...statement,bind(...args){const op=statement.bind(...args);return{...op,async first(){blockRead=false;throw Error('Synthetic readback outage');}};}};
  }
  return statement;
 };
 archived=await patch({...archiveBase,propertyId:legacy});
 eq(archived.status,503,'Committed archive without independent readback refuses success');
 eq(stored(legacy).active,0,'Physical archive may have committed despite uncertain receipt');
 rt.env.DB.prepare=old;
 archived=await patch({...archiveBase,propertyId:legacy});
 eq(archived.status,200,'Confirmed retry recovers previously committed archival');
 eq(stored(legacy).revision,2,'Recovered archived revision is immutable');

 rt.setOwner(null);
 const before=rt.counters();
 const anonymousList=await route.GET(new Request('https://synthetic.invalid/api/customer-properties?customerId=owner-property-a'));
 eq(anonymousList.status,401,'Unauthenticated property address GET refused');
 eq(anonymousList.headers.get('cache-control'),'private, no-store','Unauthorized owner property response cannot be cached');
 eq(rt.counters(),before,'Unauthorized property GET did not read D1');
 eq((await post({...base,operationId:id(5)})).status,401,'Unauthenticated caller blocked');
 eq((await patch(archiveBase)).status,401,'Unauthenticated caller cannot archive');
 eq(rt.counters(),before,'Unauthorized caller does not query D1');
 rt.setOwner({email:'other@example.invalid'});
 eq((await post({...base,operationId:id(5)})).status,401,'Nonowner cannot create property');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 rt.env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE='disabled';
 eq((await post({...base,operationId:id(5)})).status,404,'Candidate disabled feature does not activate itself');
 console.log('PASS '+checks+'/'+checks+' actual customer-property owner route, native candidate SQLite, saved readback, lost ACK/replay, operation ownership, malformed bodies and no fake success; NO Cloudflare');
}finally{rt.env.DB.prepare=old;db.close();}
