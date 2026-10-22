import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
const same=(a,b,label)=>{assert.equal(a,b,label);checks++;};
const db=new DatabaseSync(':memory:');
for(const migration of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+migration,'utf8'));
let owner={email:'kylebrooks8605@gmail.com'},writes=0;
const env={DB:{prepare(query){return{bind(...args){return{async first(){return db.prepare(query).get(...args)??null;},async run(){writes++;return{meta:{changes:Number(db.prepare(query).run(...args).changes)}};}};}}}}};
function load(path,imports){
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
    {exports,require:key=>{assert.ok(key in imports,key);return imports[key];},Date,Intl,Response,Request,crypto,console});
  return exports;
}
const services=load('lib/fire-services.ts',{});
const mod=load('lib/saved-promotions.ts',{'./fire-services':services,'./discount-input':load('lib/discount-input.ts',{})});
const api=load('app/api/saved-promotions/route.ts',{
 'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>owner},'../../../lib/saved-promotions':mod});
const id=(n)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const rule=(n,name,type,valueCents,ids=[],dateBasis='estimate-created')=>({
 id:id(n),name,type,valueCents,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis,requiredServiceIds:ids});
const october={...rule(1,'October 15%','percent',1500,[],'booking-confirmed'),startOn:'2026-10-01',endOn:'2026-10-31'};
const bundle=rule(2,'House and gutters bundle','dollar',2500,['house-wash','gutters']);
const extra=rule(3,'Another qualifying discount','percent',500);
try{
 same(mod.fireDate(new Date('2026-10-23T01:30:00Z')),'2026-10-22','Tulsa cutoff uses local date');
 ok(mod.validPromotions([october,bundle,extra]),'Multiple valid promotions');
 ok(!mod.validPromotions([october,{...october}]),'Duplicate promotion ids rejected');
 ok(!mod.validPromotions([{...bundle,requiredServiceIds:['missing']}]),'Unknown service ids rejected');
 ok(!mod.validPromotions([{...bundle,endOn:'2026-02-30'}]),'Impossible dates rejected');
 ok(!mod.validPromotions([{...october,valueCents:5001}]),'Over-cap single percent rejected');
 ok(!mod.validPromotions([{...bundle,name:'  '}]),'Blank names rejected');
 const catalog={revision:null,promotions:[october,bundle,extra]};
 const quote={serviceIds:['house-wash','gutters'],estimateOn:'2026-10-22',bookedOn:'2026-10-22',subtotalCents:46000};
 let result=mod.evaluateSavedPromotions(catalog,quote);
 same(result.offered.length,3,'Eligible overlapping promotions stack');
 same(result.percentBasisPoints,2000,'Two percent promotions summed in basis points');
 same(result.dollarCents,2500,'Dollar bundle separately applied');
 same(result.totalCents,34300,'20% plus $25 on $460');
 same(result.depositCents,17150,'Existing 50% deposit');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[october,bundle]},quote);
 same(result.totalCents,36600,'October 15% and $25 bundle = $366');
 same(result.depositCents,18300,'Deposit exactly $183');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[october,bundle]},{...quote,bookedOn:null});
 same(result.offered.length,1,'Booking-only promo not granted before booking');
 same(result.pendingBooking.length,1,'Pending booking shown explicitly');
 same(result.totalCents,43500,'Unbooked quote only has bundle');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[october,bundle]},{...quote,bookedOn:'2026-11-01'});
 same(result.totalCents,43500,'October offer not applied after booking deadline');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[october,bundle]},{...quote,serviceIds:['house-wash']});
 same(result.totalCents,39100,'Bundle requires both services');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[rule(4,'Too much','percent',5000),extra]},{...quote,appreciationDiscount:true});
 ok(Boolean(result.blocked)&&result.totalCents===null,'Overlapping promotions fail closed above percent cap');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[rule(5,'Flat A','dollar',8000),rule(6,'Flat B','dollar',5000)]},{...quote,subtotalCents:10000});
 ok(Boolean(result.blocked)&&result.totalCents===null&&result.depositCents===null,'Two flat offers over subtotal block preview instead of causing a later rejected save');
 result=mod.evaluateSavedPromotions({revision:null,promotions:[rule(5,'Flat A','dollar',8000),rule(6,'Flat B','dollar',5000)]},{...quote,subtotalCents:13000});
 same(result.totalCents,15000,'Two flat offers at subtotal still respect $150 minimum');

 result=mod.evaluateSavedPromotions({revision:null,promotions:[bundle]},{...quote,subtotalCents:10000});
 same(result.totalCents,15000,'Existing minimum remains $150');
 let response=await api.GET();same(response.status,200,'Owner may read');same((await response.json()).catalog.promotions.length,0,'New catalog empty by default');
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('historic-c','Synthetic','2026-01-01'); INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('historic-e','historic-c','approved',46000,46000,23000,'2026-01-01');");
 const historical=()=>JSON.stringify(db.prepare('SELECT * FROM estimates WHERE id=?').get('historic-e'));
 const before=historical();
 async function save(promotions,expectedRevision){return api.PUT(new Request('https://test.invalid/api/saved-promotions',{method:'PUT',body:JSON.stringify({promotions,expectedRevision})}));}
 response=await save([october,bundle],null);same(response.status,200,'Owner saves two promotions');
 const stored=(await response.json()).catalog;
 same(typeof stored.revision,'string','Server issues catalog revision');
 same(historical(),before,'Saving rules never changes historic estimate');
 const previousWrites=writes;
 response=await save([october,bundle],null);same(response.status,200,'Replay of committed absolute catalog is accepted');
 same(writes,previousWrites,'Replay made no additional write');
 response=await save([{...october,name:'Stale'},bundle],null);same(response.status,409,'Stale device blocked');
 const changed=[{...october,enabled:false},bundle];
 response=await save(changed,stored.revision);same(response.status,200,'Pause a promotion without deleting it');
 const updated=(await response.json()).catalog;
 same(updated.promotions[0].enabled,false,'Paused state persisted');
 const next=await api.GET();same((await next.json()).catalog.revision,updated.revision,'Cross-device GET sees updated revision');
 response=await save([{...october,valueCents:10001}],updated.revision);same(response.status,400,'Invalid percent request refused');
 response=await save(Array(41).fill(bundle),updated.revision);same(response.status,400,'Oversized catalog refused');
 owner=null;same((await api.GET()).status,401,'Unauthenticated GET refused');
 same((await save(changed,updated.revision)).status,401,'Unauthenticated PUT refused');
 owner={email:'not-owner@example.invalid'};same((await api.GET()).status,401,'Foreign owner refused');
 owner={email:'kylebrooks8605@gmail.com'};
 db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{broken',mod.SAVED_PROMOTIONS_KEY);
 same((await api.GET()).status,503,'Corrupt state never silently becomes an empty catalog');
 same((await save(changed,updated.revision)).status,503,'Corrupt state cannot be overwritten');
 same(historical(),before,'Historical estimate stays unchanged');
 console.log('PASS '+checks+' saved promotion catalog, stack, booking deadline, eligibility, SQLite persistence, conflicts, replay, owner access, corruption and historical safeguards.');
}finally{db.close();}
