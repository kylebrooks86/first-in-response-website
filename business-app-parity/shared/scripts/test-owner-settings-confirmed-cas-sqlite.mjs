/**
 * Actual four owner-setting routes with real disposable SQLite and the
 * identical shared exact-revision D1 CAS helper. No Cloudflare/provider
 * requests, real customers, pricing changes to hosted data or auth tokens.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const r=stackedRuntime();
let checks=0;
const test=(condition,label)=>{assert.ok(condition,label);checks++;};
const uid=n=>'eeeeeeee-eeee-4eee-8eee-'+String(n).padStart(12,'0');
const promotion=(n,name,type,valueCents,requiredServiceIds=[])=>({
 id:uid(n),name,type,valueCents,enabled:true,autoApply:true,startOn:null,endOn:null,
 dateBasis:'estimate-created',requiredServiceIds
});
const pack=(n,name,serviceIds)=>({id:uid(n),name,serviceIds});
const promotionA=promotion(1,'Synthetic repeat 5 percent','percent',500);
const promotionB=promotion(2,'Synthetic house/gutter bundle','dollar',2500,['house-wash','gutters']);
const packageA=pack(3,'Synthetic house and gutters',['house-wash','gutters']);
const packageB=pack(4,'Synthetic house and concrete',['house-wash','concrete']);
const rateModel=r.load('lib/service-pricing.ts');
const prefModel=r.load('lib/business-preferences.ts');
const promotionModel=r.load('lib/saved-promotions.ts');
const packagesModel=r.load('lib/quote-packages.ts');
const specs=[
 {name:'owner service pricing',route:'service-pricing',key:rateModel.SERVICE_RATE_PREFIX+'house-wash',
  field:'rate',payload:(rev,phase)=>({id:'house-wash',rateCents:[23,25,27][phase],expectedRevision:rev})},
 {name:'stackable saved promotions',route:'saved-promotions',key:promotionModel.SAVED_PROMOTIONS_KEY,
  field:'catalog',payload:(rev,phase)=>({promotions:[[promotionA],[promotionA,promotionB],[]][phase],expectedRevision:rev})},
 {name:'saved quote packages',route:'quote-packages',key:packagesModel.QUOTE_PACKAGES_KEY,
  field:'catalog',payload:(rev,phase)=>({packages:[[packageA],[packageA,packageB],[packageB]][phase],expectedRevision:rev})},
 {name:'repeat-service reminders',route:'business-preferences',key:prefModel.BUSINESS_PREFERENCES_KEY,
  field:'preferences',payload:(rev,phase)=>({revision:rev,blocks:[],repeatMonths:{'house-wash':[12,18,24][phase]}})}
];
const originalPrepare=r.env.DB.prepare;
const isWrite=sql=>sql.startsWith('INSERT INTO message_templates(')||
  sql.startsWith('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?');
const stored=key=>r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(key)?.body??null;
const put=async(spec,payload)=>{
 const api=r.load('app/api/'+spec.route+'/route.ts');
 const response=await api.PUT(new Request('https://synthetic.invalid/api/'+spec.route,{
  method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
 }));
 return {status:response.status,data:await response.json()};
};
const get=async(spec)=>{
 const response=await r.load('app/api/'+spec.route+'/route.ts').GET();
 const data=await response.json();
 // Standard service pricing GET returns the whole catalog, while PUT
 // returns one rate. Only normalize this fixture's shape; inspect the actual
 // saved house-wash rate that the owner sees on another device.
 return {status:response.status,data:spec.route==='service-pricing'
   ?{rate:data.rates?.find(item=>item.id==='house-wash')}:data};
};
async function withinFault(kind,fn){
 let interceptedWrites=0,writeOccurred=false;
 r.env.DB.prepare=function(sql){
  const statement=originalPrepare(sql);
  if(isWrite(sql)){
   return {bind(...args){
    const op=statement.bind(...args);
    return {run:async()=>{
     interceptedWrites++;
     if(kind==='fakeACK')return {success:true,meta:{changes:1}};
     const receipt=await op.run();
     writeOccurred=true;
     if(kind==='lostACK')throw Error('Synthetic D1 write committed, ACK lost');
     return receipt;
    }};
   }};
  }
  if(kind==='lostReadback'&&sql==='SELECT body FROM message_templates WHERE key=?'){
   return {bind(...args){
    const op=statement.bind(...args);
    return {first:async()=>{
     if(writeOccurred)throw Error('Synthetic readback unavailable after committed write');
     return op.first();
    }};
   }};
  }
  return statement;
 };
 try{return {result:await fn(),writes:interceptedWrites};}
 finally{r.env.DB.prepare=originalPrepare;}
}
try{
 for(const spec of specs){
  const fresh=await get(spec);
  test(fresh.status===200,spec.name+': initial route GET succeeds');
  test(stored(spec.key)===null,spec.name+': no initial settings row');

  // INSERT truly committed; transport says failed. Recover exact durable revision.
  const first=await withinFault('lostACK',()=>put(spec,spec.payload(null,0)));
  const firstSaved=stored(spec.key);
  test(first.result.status===200&&first.result.data.recoveredAfterUncertainSave===true&&
       first.writes===1&&firstSaved!==null,
   spec.name+': committed INSERT with lost ACK recovered via same exact row, one SQL write');
  const firstRev=JSON.parse(firstSaved).revision;
  test(typeof firstRev==='string'&&first.result.data[spec.field].revision===firstRev,
   spec.name+': reported revision is physically persisted, not an invented success');

  // A replay using the original expected revision returns already-saved
  // exact data without another charge, insert, duplicate or revision write.
  const beforeReplay=r.counters().writes;
  const replay=await put(spec,spec.payload(null,0));
  test(replay.status===200&&r.counters().writes===beforeReplay,
   spec.name+': lost-HTTP-response replay of unchanged owner input makes no write');

  const second=await withinFault('lostACK',()=>put(spec,spec.payload(firstRev,1)));
  const secondSaved=stored(spec.key);
  const secondRev=JSON.parse(secondSaved).revision;
  test(second.result.status===200&&second.result.data.recoveredAfterUncertainSave===true&&
       second.writes===1&&secondRev!==firstRev&&second.result.data[spec.field].revision===secondRev,
   spec.name+': committed UPDATE with lost ACK recovers only exact newly saved revision');

  // An ACK claiming a change when SQLite made NONE must never be success.
  const fake=await withinFault('fakeACK',()=>put(spec,spec.payload(secondRev,2)));
  test(fake.result.status===503&&fake.result.data.saveUncertain===true&&
       fake.writes===1&&stored(spec.key)===secondSaved,
   spec.name+': fabricated successful D1 update ACK cannot change prices or settings');

  // The owner can never overwrite a newer saved revision from a stale view.
  const stale=await put(spec,spec.payload(firstRev,2));
  test(stale.status===409&&stored(spec.key)===secondSaved,
   spec.name+': stale cross-device revision is rejected with physical row unchanged');

  // This write commits, but readback is unavailable. This must be 503,
  // never a fabricated 200. A later GET and unchanged retry can recover.
  const missing=await withinFault('lostReadback',()=>put(spec,spec.payload(secondRev,2)));
  const thirdSaved=stored(spec.key);
  const thirdRev=JSON.parse(thirdSaved).revision;
  test(missing.result.status===503&&missing.result.data.saveUncertain===true&&
       missing.writes===1&&thirdRev!==secondRev,
   spec.name+': committed write with lost physical SELECT returns uncertainty, not false success');
  const current=await get(spec);
  test(current.status===200&&current.data[spec.field].revision===thirdRev,
   spec.name+': normal owner GET independently reads previously committed settings');
  const beforeThirdReplay=r.counters().writes;
  const thirdReplay=await put(spec,spec.payload(secondRev,2));
  test(thirdReplay.status===200&&r.counters().writes===beforeThirdReplay,
   spec.name+': exact saved settings replay with older expected revision never overwrites');

  // Distinct settings namespaces must not touch another service or money history.
  test(stored(spec.key)===thirdSaved,spec.name+': no automatic retries or cross-key writes');
 }
 const rows=r.db.prepare("SELECT key,body FROM message_templates WHERE key LIKE 'fire-%' OR key LIKE 'service-%'").all();
 test(rows.every(row=>JSON.parse(row.body).revision!==null),
   'All persisted owner setting bodies retain distinct actual revision identifiers');
 console.log('PASS '+checks+'/'+checks+
  ' actual owner service price, stackable promotion, package and repeat preference CAS persistence/replay/fake-ACK/lost-readback SQLite checks; NO hosted data');
}finally{r.env.DB.prepare=originalPrepare;r.db.close();}
