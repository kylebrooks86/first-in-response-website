/** Real owner quote-package API on disposable SQLite, plus pure pricing and privacy checks. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const r=stackedRuntime(),model=r.load('lib/quote-packages.ts'),api=r.load('app/api/quote-packages/route.ts');
const services=r.load('lib/fire-services.ts').FIRE_SERVICES;
const uuid=n=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0');
const pkg=(n,name,ids)=>({id:uuid(n),name,serviceIds:ids});
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const read=async()=>{const response=await api.GET();return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};};
const put=async(packages,expectedRevision)=>{const response=await api.PUT(new Request('https://synthetic.invalid/api/quote-packages',{method:'PUT',body:JSON.stringify({packages,expectedRevision})}));return {status:response.status,body:await response.json()};};
const snapshot=()=>JSON.stringify(['customers','estimates','estimate_items','payments','invoices','message_templates'].map(t=>r.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()));
try{
 const fresh=await read();
 eq(fresh.status,200,'Owner can load empty package catalog');
 eq(fresh.body.catalog,{revision:null,packages:[]},'First use requires no DB migration');
 eq(fresh.cache,'private, no-store','Package records never shared via cache');
 const mix=pkg(1,'House + gutters',['house-wash','gutters']);
 const first=await put([mix],null);
 eq(first.status,200,'Save reusable service mix');
 eq(model.validQuotePackageCatalog(first.body.catalog),true,'Server returns validated package catalog');
 const rev=first.body.catalog.revision;
 eq(typeof rev,'string','Server creates a revision for optimistic locking');
 const saved=r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(model.QUOTE_PACKAGES_KEY).body;
 eq(saved.includes('House + gutters'),true,'Only intended service grouping persisted');
 eq(saved.includes('subtotalCents'),false,'No saved quote totals');
 eq(saved.includes('description'),false,'No custom scope description');
 eq(saved.includes('quantity'),false,'No previous quantities');
 eq(saved.includes('rateCents'),false,'No past rate');
 eq(saved.includes('customerId'),false,'No customer identity');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n,0,'Saving a package cannot create an estimate');
 const oldReads=await read();eq(oldReads.body.catalog.revision,rev,'Saved revision appears after cross-device GET');
 const writes=r.counters().writes;
 const replay=await put([mix],null);
 eq(replay.status,200,'Lost-response retry of identical absolute package catalog is acknowledged');
 eq(r.counters().writes,writes,'Exact replay performs no new SQL writes');
 const before=snapshot();
 let conflict=await put([pkg(2,'Changed',['house-wash'])],null);
 eq(conflict.status,409,'Stale device cannot overwrite another saved package');
 eq(snapshot(),before,'CAS rejection leaves all persisted records unchanged');
 for(const invalid of [
  [pkg(3,'Unknown',['unlisted'])],
  [pkg(4,'Duplicate',['house-wash','house-wash'])],
  [pkg(5,'Dangerous customer <script>',['gutters'])],
  [mix,pkg(6,'house + GUTTERS',['windows'])],
  [mix,{...mix,id:uuid(7)}],
  Array.from({length:21},(_,i)=>pkg(i+100,'Package '+i,['house-wash'])),
  [pkg(8,'Blank ',['gutters'])],
 ]){
  eq((await put(invalid,rev)).status,400,'Malformed, unsupported or oversized package is rejected');
  eq(snapshot(),before,'Invalid package cannot mutate DB or financial data');
 }
 eq(model.validQuotePackages([mix]),true,'Pure model accepts known services');
 eq(model.validQuotePackages([{...mix,serviceIds:['missing-service']}]),false,'Unknown service types always blocked');
 const current=services.map(s=>s.id==='house-wash'?{...s,rate:31}:s.id==='gutters'?{...s,rate:175}:s);
 const lines=model.packageDraftLines(mix.serviceIds,current);
 eq(lines.length,2,'Saved mix reconstructs two current service lines');
 eq(lines[0].quantity,0,'First selected service requires quantity entry');
 eq(lines[1].quantity,0,'Second selected service requires quantity entry');
 eq(lines[0].unitRateCents,31,'House wash uses current owner-configured rate, not prior quote');
 eq(lines[1].unitRateCents,175,'Gutters use current owner-configured rate, not prior quote');
 eq(lines[0].name,services.find(s=>s.id==='house-wash').name,'Current catalog supplies service name');
 eq(lines[0].description,services.find(s=>s.id==='house-wash').description,'Current standard scope supplied, not old customer notes');
 eq(Object.keys(lines[0]).sort(),['description','name','quantity','serviceId','unit','unitRateCents'].sort(),'No id, old customer, price total, discount or old invoice imported');
 eq(model.packageDraftLines(['house-wash','no-service'],current),null,'Unknown service stops entire package');
 eq(model.packageDraftLines(['gutters','gutters'],current),null,'Duplicate service setup fails');
 eq(model.packageDraftLines(['gutters'],current.filter(s=>s.id!=='gutters')),null,'Missing current rate blocks package application');
 eq(model.packageDraftLines(['gutters'],current.map(s=>s.id==='gutters'?{...s,rate:1.25}:s)),null,'Fractional cent rate blocks package application');
 const newer=[mix,pkg(9,'House + concrete',['house-wash','concrete'])];
 const updated=await put(newer,rev);
 eq(updated.status,200,'Second package saves with current CAS revision');
 eq((await read()).body.catalog.packages.length,2,'Cross-device lookup contains both mixes');
 eq((await put([mix],rev)).status,409,'Earlier revision cannot remove second owner package');
 const final=await put([newer[1]],updated.body.catalog.revision);
 eq(final.status,200,'Explicit delete of saved package succeeds');
 eq((await read()).body.catalog.packages.length,1,'Deleted package removed without modifying quotes');
 r.setOwner(null);
 eq((await read()).status,401,'Unauthenticated package list rejected');
 eq((await put([mix],null)).status,401,'Unauthenticated package write rejected');
 r.setOwner({email:'other@example.invalid'});
 eq((await read()).status,401,'Nonowner cannot read service packages');
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{broken',model.QUOTE_PACKAGES_KEY);
 eq((await read()).status,503,'Corrupt saved catalog cannot silently become empty');
 eq((await put([mix],null)).status,503,'Corrupt saved catalog cannot be overwritten');
 const source=readFileSync('app/dashboard.tsx','utf8');
 eq(source.includes('<QuotePackages')||source.includes('onApply={addQuotePackage}'),false,
   'Owner-approved New Estimate simplification leaves no visible reusable-package chooser');
 eq(source.includes('Add another service'),true,'Ordinary manual multi-service quoting remains available');
 eq(source.includes('Separate bundle discount ($)'),true,'Stackable bundle discount remains independent of saved package mixes');
 eq(source.includes('<NewEstimatePromotions '),true,'Saved-promotion verification is still part of New Estimate');
 eq(source.includes('setPromotionEvidence(null)'),true,'Manual quote changes continue clearing stale promotion evidence');
 console.log('PASS '+checks+'/'+checks+' legacy owner package SQLite/API compatibility, CAS/races, privacy, corruption and simplified New Estimate with manual service additions/discounts.');
}finally{r.db.close();}
