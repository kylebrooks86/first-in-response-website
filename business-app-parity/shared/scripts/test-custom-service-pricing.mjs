import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{pricingRuntime}from'./pricing-test-runtime.mjs';
const r=pricingRuntime();let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try{
 let {response,data}=await r.get();eq(response.status,200);eq(response.headers.get('cache-control'),'no-store');eq(data.rates.length,58);
 for(const service of r.catalog.FIRE_SERVICES)eq(data.rates.find(s=>s.id===service.id),{id:service.id,rateCents:service.rate,revision:null});
 const {priceCents,validServiceRates}=r.pricing;
 for(const [raw,expected]of [['0',0],['.22',22],['00.40',40],['0.22',22],['1.50',150],['0.40',40],['999.99',99999],['12.3',1230]])eq(priceCents(raw),expected);
 for(const raw of ['','-1','1.005','NaN','Infinity','1e3',' 1','1,000','0x10','9007199254740991'])eq(priceCents(raw),null);
 eq(validServiceRates(data.rates),true);eq(validServiceRates(data.rates.slice(1)),false);eq(validServiceRates([...data.rates.slice(1),data.rates[1]]),false);
 r.db.exec("INSERT INTO customers(id,name,created_at) VALUES ('history-c','Synthetic customer','2026-01-01'); INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,signed_name,signed_at,created_at) VALUES('history-e','history-c','approved',44000,44000,22000,'Synthetic signer','2026-01-01','2026-01-01'); INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES('history-line','history-e','House Wash','Agreed',2000,'sq ft',44000); INSERT INTO invoices(id,estimate_id,customer_id,total_cents,created_at) VALUES('history-i','history-e','history-c',44000,'2026-01-01'); INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('history-p','history-e','Deposit',22000,'paid','2026-01-01');");
 const history=()=>JSON.stringify(['customers','estimates','estimate_items','invoices','payments'].map(t=>r.db.prepare('SELECT * FROM '+t).all()));const before=history();
 const input={id:'house-wash',rateCents:25,expectedRevision:null};response=await r.put(input);eq(response.status,200);const first=(await response.json()).rate;eq(first.rateCents,25);eq(typeof first.revision,'string');eq(history(),before,'Standard changes never rewrite historical money/signatures');
 const writes=r.counters().writes;eq((await r.put(input)).status,200,'Lost-response retry returns stored absolute setting');eq(r.counters().writes,writes,'Duplicate save performs no second write');
 eq((await r.put({...input,rateCents:27})).status,409,'Stale cross-device revision refused');eq((await r.put({...input,rateCents:0,expectedRevision:first.revision})).status,200,'Zero defaults remain allowed without new pricing floor');
 for(const body of [null,[],{},'{bad', {...input,id:'unknown'},{...input,rateCents:-1},{...input,rateCents:0.5},{...input,rateCents:'25'},{...input,rateCents:Number.MAX_SAFE_INTEGER+1},{...input,unexpected:true},{...input,expectedRevision:12}])eq((await r.put(body)).status,400);
 for(const id of ['gutters','fence','custom']){response=await r.put({id,rateCents:123,expectedRevision:null});eq(response.status,200);}
 eq((await r.get()).data.rates.find(s=>s.id==='gutters').rateCents,123,'Another device reads confirmed default');eq(history(),before);
 r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES ('estimate','Original subject','Original customer text','2026-01-01')").run();await r.put({id:'roof-wash',rateCents:16000,expectedRevision:null});eq(r.db.prepare("SELECT body FROM message_templates WHERE key='estimate'").get().body,'Original customer text','Namespaced settings never change templates');
 const concurrent=await Promise.all([r.put({id:'deck',rateCents:35,expectedRevision:null}),r.put({id:'deck',rateCents:45,expectedRevision:null})]);eq(concurrent.map(x=>x.status).sort(),[200,409],'Atomic CAS refuses a racing first save');
 // Metadata is versioned with the rate; old rate-only clients preserve it.
 const details={name:'Deck custom name',description:'Reviewed scope',unit:'each',category:'supplemental',active:true};
 let deck=(await r.get()).data.rates.find(s=>s.id==='deck');
 response=await r.put({id:'deck',rateCents:45,details,expectedRevision:deck.revision});eq(response.status,200);deck=(await response.json()).rate;
 eq(deck.details,details);eq(history(),before,'Metadata does not rewrite accepted documents');
 response=await r.put({id:'deck',rateCents:46,expectedRevision:deck.revision});eq(response.status,200);deck=(await response.json()).rate;eq(deck.details,details,'Rate-only save preserves name/unit');
 const unchanged=r.counters().writes;eq((await r.put({id:'deck',rateCents:46,details,expectedRevision:null})).status,200);eq(r.counters().writes,unchanged,'Exact lost-response retry is read-only');
 eq((await r.put({id:'deck',rateCents:46,details:{...details,name:'Stale change'},expectedRevision:null})).status,409,'Metadata needs the current revision');
 for(const invalid of [{...details,name:''},{...details,unit:'acre'},{...details,active:'false'},{...details,category:'automatic'},{...details,extra:1}])eq((await r.put({id:'deck',rateCents:46,details:invalid,expectedRevision:deck.revision})).status,400);
 response=await r.put({id:'deck',rateCents:46,details:{...details,active:false},expectedRevision:deck.revision});eq(response.status,200);
 let list=(await r.get()).data.rates;eq(r.pricing.catalogServices(list).some(s=>s.id==='deck'),false,'Inactive services hidden from new selection');eq(r.pricing.catalogServices(list,true).some(s=>s.id==='deck'),true,'Deactivation is reversible');
 const id='catalog-'+crypto.randomUUID(),customDetails={name:'Owner custom service',description:'Exact custom scope',unit:'linear ft',category:'other',active:true};
 response=await r.put({id,rateCents:1234,details:customDetails,expectedRevision:null});eq(response.status,200);const added=(await response.json()).rate;
 eq((await r.put({id,rateCents:1234,details:customDetails,expectedRevision:null})).status,200,'New service stable ID retry');
 list=(await r.get()).data.rates;eq(r.pricing.validServiceRates(list),true);eq(list.length,59);eq(r.pricing.catalogServices(list).find(s=>s.id===id).name,customDetails.name,'Custom services available in editor catalog');
 eq((await r.put({id,rateCents:1200,details:customDetails,expectedRevision:null})).status,409);
 eq((await r.put({id:'catalog-'+crypto.randomUUID(),rateCents:1234,expectedRevision:null})).status,400,'No unlabelled custom service');
 eq(history(),before,'All customer, signed, invoice and payment rows retained');
 const snapshot=r.counters();r.setOwner(null);eq((await r.get()).response.status,401);eq((await r.put(input)).status,401);eq(r.counters(),snapshot,'Unauthenticated callers never read or write');r.setOwner({email:'foreign@example.invalid'});eq((await r.put(input)).status,401);r.setOwner({email:'kylebrooks8605@gmail.com'});
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{bad',r.pricing.SERVICE_RATE_PREFIX+'house-wash');eq((await r.get()).response.status,503,'Corrupt standard never silently falls back to old catalog');
 const money=r.load('lib/editable-line-totals.ts',{});let line={quantity:1660,unitRateCents:22};eq(money.editableLineTotalCents(line),36520);line=money.editMoneyLine(line,{unitRateCents:25});eq(money.editableLineTotalCents(line),41500);line=money.editMoneyLine(line,{flatPriceCents:30001});eq(money.editableLineTotalCents(line),30001);line=money.editMoneyLine(line,{quantity:2000});eq(money.editableLineTotalCents(line),30001,'Flat total independent of measurement');line=money.editMoneyLine(line,{flatPriceCents:undefined,unitRateCents:22});eq(money.editableLineTotalCents(line),44000,'Reset restores standard times retained quantity');
 const saved={quantity:3,...money.restoreEditableLineMoney(3,30001)};eq(money.editableLineTotalCents(saved),30001,'Stored flat total preserved exactly after reopening');eq(money.editableLineTotalCents(money.editMoneyLine(saved,{description:'Changed scope'})),30001,'Description edit cannot reprice historical line');
 const source=readFileSync('app/dashboard.tsx','utf8');const start=source.indexOf('function discountMath('),end=source.indexOf('function NewEstimate(',start);// Arithmetic below uses the actual editor discount function.
 const ts=await import('typescript'),vm=await import('node:vm');const context={exports:{}};vm.runInNewContext(ts.default.transpileModule(source.slice(start,end)+'\nexports.discountMath=discountMath',{compilerOptions:{module:ts.default.ModuleKind.CommonJS}}).outputText,context);
 // Exercise the ACTUAL dashboard formatter: never turn a real $150.01
 // balance or $365.25 quote into a misleading rounded whole-dollar amount.
 const displayMoneyDeclaration=source.match(/^const money = \(cents: number\) => .*;$/m);
 assert.ok(displayMoneyDeclaration,'Actual shared dashboard money formatter is required');checks++;
 const moneyVm={exports:{}};
 vm.runInNewContext(ts.default.transpileModule(displayMoneyDeclaration[0]+'\nexports.displayMoney=money;',{
   compilerOptions:{target:ts.default.ScriptTarget.ES2022,module:ts.default.ModuleKind.CommonJS}
 }).outputText,moneyVm);
 for(const [cents,display] of [[15000,'$150'],[15001,'$150.01'],[36525,'$365.25'],[99,'$0.99'],[0,'$0'],[-125,'-$1.25']])eq(moneyVm.exports.displayMoney(cents),display,'Actual UI currency display for '+cents+' cents');
 const totals=context.exports.discountMath(44000,false,'percent',15);eq(totals.total,37400);eq(totals.deposit,18700);eq(context.exports.discountMath(0,false,'percent',0,true).total,0,'Zero-priced service previews actual $0 price');eq(context.exports.discountMath(0,false,'percent',0,true).deposit,0,'Zero-priced service has no deposit');eq(context.exports.discountMath(0,false,'percent',0).total,0,'Empty draft remains an empty preview');eq(context.exports.discountMath(1000,false,'dollar',0).total,1000,'Owner-selected $10 service is not inflated');eq(context.exports.discountMath(44000,true,'percent',45).total,22000,'Existing discount cap unchanged');
 console.log('PASS '+checks+' custom-pricing checks: all 58 defaults, actual SQLite persistence, retry/conflict/auth guards, historical financial preservation, flat/rate/reset arithmetic and existing discounts.');
}finally{r.db.close();}
