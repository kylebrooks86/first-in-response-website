/** Real owner-only saved-promotion preview API with disposable SQLite. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let reads=0,writes=0,owner={email:'kylebrooks8605@gmail.com'};
const env={DB:{prepare(q){return{bind(...args){return{async first(){reads++;return db.prepare(q).get(...args)??null;},async run(){writes++;return{meta:{changes:Number(db.prepare(q).run(...args).changes)}};}};}}}}};
function load(path,imports){const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,require:key=>{if(!(key in imports))throw Error('Unexpected import '+key);return imports[key];},Response,Request,crypto,Date,Intl});
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
 eq(data.checkedOn,'2026-10-22','Server verifies Tulsa calendar date');
 eq(writes,beforeWrites,'Preview never writes settings/quotes');
 eq(JSON.stringify(db.prepare('SELECT * FROM message_templates').all()),before,'Preview leaves persisted data unchanged');
 save([bundle,{...bundle,id:uid(4),name:'Second flat offer',valueCents:3000}]);
 let tooLarge=await preview({...valid,subtotalCents:4000});
 eq(tooLarge.status,200,'Overlapping flat discount preview responds safely');
 const rejected=await tooLarge.json();
 eq(Boolean(rejected.blocked),true,'Oversubscribed dollar offers are clearly blocked');
 eq(rejected.previewTotalCents,null,'Unsafe flat promotions never show a misleading total');
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
