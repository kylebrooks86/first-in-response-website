/** Real owner-only saved-promotion preview API with disposable SQLite. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
// Freeze only the disposable VM's clock. The actual API implementation is
// unchanged; this test must keep working after October 2026 and across DST.
let clockMs=Date.parse('2026-10-22T18:00:00.000Z');
class ScenarioDate extends Date {
 constructor(...args){super(...(args.length?args:[clockMs]));}
 static now(){return clockMs;}
}
const at=(utc)=>{clockMs=Date.parse(utc);assert.ok(Number.isFinite(clockMs));};
let reads=0,writes=0,owner={email:'kylebrooks8605@gmail.com'};
const env={DB:{prepare(q){return{bind(...args){return{async first(){reads++;return db.prepare(q).get(...args)??null;},async run(){writes++;return{meta:{changes:Number(db.prepare(q).run(...args).changes)}};}};}}}}};
function load(path,imports){const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,require:key=>{if(!(key in imports))throw Error('Unexpected import '+key);return imports[key];},Response,Request,crypto,Date:ScenarioDate,Intl});
 return exports;
}
const services=load('lib/fire-services.ts',{});
const model=load('lib/saved-promotions.ts',{'./fire-services':services,'./discount-input':load('lib/discount-input.ts',{})});
const api=load('app/api/saved-promotions/preview/route.ts',{
 'cloudflare:workers':{env},'../../../chatgpt-auth':{getChatGPTUser:async()=>owner},
 '../../../../lib/fire-services':services,'../../../../lib/saved-promotions':model});
const uid=n=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0');
const booking={id:uid(1),name:'October 15%',type:'percent',valueCents:1500,enabled:true,autoApply:true,startOn:'2026-10-01',endOn:'2026-10-31',dateBasis:'booking-confirmed',requiredServiceIds:[]};
const bundle={id:uid(2),name:'House plus gutters',type:'dollar',valueCents:2500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:['house-wash','gutters']};
const free={id:uid(3),name:'Fall 10%',type:'percent',valueCents:1000,enabled:true,autoApply:true,startOn:'2026-10-01',endOn:'2026-10-31',dateBasis:'estimate-created',requiredServiceIds:[]};
function save(rules){db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'2026-10-22') ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(model.SAVED_PROMOTIONS_KEY,JSON.stringify({revision:uid(99),promotions:rules}));}
async function preview(body){return api.POST(new Request('https://synthetic.invalid/api/saved-promotions/preview',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));}
const valid={serviceIds:['house-wash','gutters'],subtotalCents:46000,appreciationDiscount:false};
try{
 let response=await preview(valid);eq(response.status,200,'Empty catalog succeeds');let data=await response.json();eq(data.eligible.length,0);eq(data.previewTotalCents,46000);eq(writes,0,'Preview makes no writes');
 save([booking,bundle,free]);const beforeWrites=writes;const before=JSON.stringify(db.prepare('SELECT * FROM message_templates').all());
 response=await preview(valid);eq(response.status,200);data=await response.json();
 eq(data.eligible.length,2,'Created-date and qualifying bundle included');
 eq(data.pendingBooking.length,1,'October booking-only promo stays pending');
 eq(data.percentBasisPoints,1000,'Only qualified percentage auto-applies');
 eq(data.dollarCents,2500,'Bundle eligible');
 eq(data.previewTotalCents,38900,'$460 minus $46 and $25');
 eq(data.previewDepositCents,19450,'Half of verified quote');
 eq(data.checkedOn,'2026-10-22','Server verifies Tulsa calendar date from pinned clock');
 eq(writes,beforeWrites,'Preview never writes settings/quotes');
 eq(JSON.stringify(db.prepare('SELECT * FROM message_templates').all()),before,'Preview leaves persisted data unchanged');
 // Calendar boundaries are Chicago-local, not GitHub runner/UTC dates.
 // 2026-11-01T04:59:59Z is Oct 31 at 11:59:59 PM in Tulsa (CDT).
 at('2026-11-01T04:59:59.000Z');
 response=await preview(valid);eq(response.status,200,'Final October booking day remains a valid estimate day');
 data=await response.json();eq(data.checkedOn,'2026-10-31','Tulsa Oct 31 remains Oct 31 near UTC midnight');
 eq(data.pendingBooking.length,1,'Oct 31 booking-only 15% awaits owner confirmation');
 eq(data.percentBasisPoints,1000,'Oct 31 created-date savings remain within promotion window');
 response=await preview({...valid,bookingConfirmedOn:'2026-10-31'});
 eq(response.status,200,'Owner can confirm October 31 booking on the final deadline day');
 data=await response.json();eq(data.percentBasisPoints,2500,'15% booking plus separate 10% estimate promotions both qualify at cutoff');
 eq(data.dollarCents,2500,'$25 service bundle remains stackable at cutoff');
 eq(data.previewTotalCents,32000,'Final-day combined 25% and flat $25 discounts use exact cents');
 at('2026-11-01T05:00:00.000Z');
 response=await preview(valid);eq(response.status,200,'Midnight Tulsa rolls promotion date to November 1');
 data=await response.json();eq(data.checkedOn,'2026-11-01','Tulsa date rolls at local midnight, not UTC midnight');
 eq(data.pendingBooking.length,0,'Unconfirmed October 15% no longer offered after deadline');
 eq(data.percentBasisPoints,0,'Expired estimate-created 10% cannot auto-apply');
 eq(data.dollarCents,2500,'Undated qualifying $25 bundle still applies');
 eq(data.previewTotalCents,43500,'After October only eligible bundle changes total');
 response=await preview({...valid,bookingConfirmedOn:'2026-10-31'});
 eq(response.status,200,'Historical owner-confirmed October 31 booking can still be reviewed November 1');
 data=await response.json();eq(data.percentBasisPoints,1500,'Oct 31 booking date preserves agreed 15% even on November estimate review');
 eq(data.dollarCents,2500,'Stacked bundle survives later completion/review date');
 eq(data.previewTotalCents,36600,'Confirmed booking discount $460 => $366 even when quote reviewed later');
 eq(data.previewDepositCents,18300,'Historical eligible booking still uses $183 half-deposit');
 response=await preview({...valid,bookingConfirmedOn:'2026-11-02'});
 eq(response.status,400,'Future owner booking attestation is rejected after October deadline');
 // Restore the pinned in-campaign fixture for subsequent unchanged negative tests.
 at('2026-10-22T18:00:00.000Z');
 save([bundle,{...bundle,id:uid(4),name:'Second flat offer',valueCents:3000}]);
 let tooLarge=await preview({...valid,subtotalCents:4000});
 eq(tooLarge.status,200,'Overlapping flat discount preview responds safely');
 const rejected=await tooLarge.json();
 eq(Boolean(rejected.blocked),true,'Oversubscribed dollar offers are clearly blocked');
 eq(rejected.previewTotalCents,null,'Unsafe flat promotions never show a misleading total');
 save([booking,bundle,free]);
 // Booking-only savings are unlocked solely by an explicit owner-provided date.
 const alwaysBooking={...booking,startOn:null,endOn:null};
 save([alwaysBooking,bundle]);
 response=await preview(valid);data=await response.json();
 eq(data.pendingBooking.length,1,'Booking-only offer remains pending without owner attestation');
 const tulsaToday=data.checkedOn;
 response=await preview({...valid,bookingConfirmedOn:tulsaToday});eq(response.status,200,'Explicit owner booking date is accepted');
 data=await response.json();eq(data.bookingConfirmedOn,tulsaToday,'Verified booking date echoed for quote evidence');
 eq(data.pendingBooking.length,0,'Confirmed booking no longer pending');
 eq(data.percentBasisPoints,1500,'Booking-confirmed 15% applies to quote');
 eq(data.dollarCents,2500,'Existing $25 service bundle stacks');
 eq(data.previewTotalCents,36600,'Booking 15% plus $25 gives $366');
 eq(data.previewDepositCents,18300,'Confirmed booking quote requires $183 half deposit');
 const farFuture='2099-12-31';
 for(const invalid of [null,'',false,'2026-02-30',farFuture,'2026-10-22T00:00:00Z']){
  eq((await preview({...valid,bookingConfirmedOn:invalid})).status,400,'Unverified booking date rejected');
 }
 save([booking,bundle,free]);
 response=await preview({...valid,serviceIds:['house-wash']});data=await response.json();eq(data.dollarCents,0,'Missing gutters disqualifies bundle');
 for(const bad of [
  {...valid,subtotalCents:-5},{...valid,subtotalCents:0.1},{...valid,serviceIds:['bad-service']},
  {...valid,serviceIds:['gutters','gutters']},{...valid,appreciationDiscount:'false'},
  {...valid,checkedOn:'2026-10-22'},{...valid,bookedOn:'2026-10-22'}
 ])eq((await preview(bad)).status,400,'Malformed or forged eligibility is refused');
 owner=null;eq((await preview(valid)).status,401,'Unauthenticated user refused');
 owner={email:'intruder@example.invalid'};eq((await preview(valid)).status,401,'Nonowner refused');
 owner={email:'kylebrooks8605@gmail.com'};
 db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{invalid',model.SAVED_PROMOTIONS_KEY);
 eq((await preview(valid)).status,503,'Corrupt catalog fails closed');
 console.log('PASS '+checks+' owner-only server date promotion preview, pending booking, stacked eligibility, no-write and corrupt-state guards.');
}finally{db.close();}
