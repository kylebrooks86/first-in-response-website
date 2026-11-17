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
 return {status:response.status,body:await response.json()};
};
const raw=body=>new Request('https://synthetic.invalid/api/customer-properties',{method:'POST',body});
const stored=key=>db.prepare('SELECT * FROM customer_properties WHERE id=?').get(key)??null;
const n=()=>db.prepare('SELECT COUNT(*) AS n FROM customer_properties').get().n;
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
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
  eq((await route.POST(request)).status,expected,label+' refused before query');
  eq(rt.counters(),before,label+' performs no D1 reads or writes');
 }
 let result=await post(base);
 eq(result.status,201,'Owner creates once with exact operation UUID');
 eq(result.body.property.id,base.operationId,'Server stores caller operation ID as immutable property ID');
 eq(stored(id(1)).customer_id,base.customerId,'Native SQLite retained right owner');
 eq(n(),1,'Only one record exists');
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
 rt.setOwner(null);
 const before=rt.counters();
 eq((await post({...base,operationId:id(5)})).status,401,'Unauthenticated caller blocked');
 eq(rt.counters(),before,'Unauthorized caller does not query D1');
 rt.setOwner({email:'other@example.invalid'});
 eq((await post({...base,operationId:id(5)})).status,401,'Nonowner cannot create property');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 rt.env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE='disabled';
 eq((await post({...base,operationId:id(5)})).status,404,'Candidate disabled feature does not activate itself');
 console.log('PASS '+checks+'/'+checks+' actual customer-property owner route, native candidate SQLite, saved readback, lost ACK/replay, operation ownership, malformed bodies and no fake success; NO Cloudflare');
}finally{rt.env.DB.prepare=old;db.close();}
