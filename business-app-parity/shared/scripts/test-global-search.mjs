/** Actual authenticated search route; real SQLite; no browser index or mutation. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
db.exec(readFileSync('db/candidate-service-locations.sql','utf8'));db.exec(readFileSync('db/candidate-customer-properties.sql','utf8'));
let user={email:'kylebrooks8605@gmail.com'},reads=0,fail=false;
const env={FIRE_SERVICE_LOCATIONS_CANDIDATE:'synthetic-only',FIRE_CUSTOMER_PROPERTIES_CANDIDATE:'synthetic-only',DB:{prepare(sql){return {values:[],bind(...values){return {...this,values}},async all(){reads++;if(fail)throw Error('Synthetic unavailable');try{return {results:db.prepare(sql).all(...this.values)}}catch(e){console.error('Synthetic search SQL error',e.message,sql,this.values);throw e}},async run(){throw Error('Unexpected write')},async first(){throw Error('Unexpected read')}}},async batch(){throw Error('Unexpected write')}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>user),route=load('app/api/search/route.ts');
const get=(q,scope='all')=>route.GET(new Request('https://synthetic.invalid/api/search?q='+encodeURIComponent(q)+'&scope='+encodeURIComponent(scope)));
const search=async(q,scope)=>{const r=await get(q,scope);assert.equal(r.status,200);return r.json()};
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 db.prepare("INSERT INTO customers(id,name,email,phone,address,created_at) VALUES('c','Synthetic Same Name','first@example.invalid','(918) 555-0101','456 Synthetic QA Lane','2026-10-18')").run();
 db.prepare("INSERT INTO customers(id,name,email,address,created_at) VALUES('other','Synthetic Same Name','second@example.invalid','Other street','2026-10-18')").run();
 for(let i=0;i<65;i++){const id='estimate-'+String(i).padStart(3,'0');db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at,scheduled_at) VALUES(?,'c',?,20000,20000,10000,?,?)").run(id,i===0?'scheduled':'sent','2026-10-'+String(1+i%18).padStart(2,'0'),i===0?'2026-10-20T15:00:00Z':null);db.prepare("INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,?,'Gutter limitation details',1,'job',20000)").run('item-'+i,id,i===0?'Special Search Gutter Service':'Generic Search Service');}
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents,created_at) VALUES('6528c9aa-0000-4000-8000-000000000001','estimate-000','c',20000,'2026-10-18')").run();
 db.prepare("INSERT INTO invoice_items(id,invoice_id,name,description,quantity,unit,total_cents) VALUES('ii','6528c9aa-0000-4000-8000-000000000001','Invoice Search Service','Invoice-only metadata',1,'job',20000)").run();
 const before=reads;user=null;eq((await get('6528C9')).status,401);user={email:'other@example.invalid'};eq((await get('Synthetic')).status,401);eq(reads,before);user={email:'kylebrooks8605@gmail.com'};
 eq((await get('a'.repeat(161))).status,400);eq((await get('a','private')).status,400);eq((await search('')).results,[]);
 for(const q of ['6528C9','6528c9','#6528C9','Invoice #6528c9','6528c9aa-0000-4000-8000-000000000001']){const r=await search(q);eq(r.results[0].id,'6528c9aa-0000-4000-8000-000000000001');eq(r.results[0].title,'Invoice #6528C9');eq(r.results[0].kind,'invoice');eq(r.results.some(x=>'shareToken' in x),false);}
 for(const q of ['sYnThEtIc SaMe','first@','918-555-010','+1 9185550101','Synthetic QA La'])eq((await search(q,'customers')).results.some(x=>x.id==='c'),true);
 eq((await search('Synthetic Same','customers')).results.length,2);eq((await search('Special Search','estimates')).results[0].id,'estimate-000');eq((await search('limitation','jobs')).results[0].id,'estimate-000');eq((await search('Invoice-only','invoices')).results[0].kind,'invoice');eq((await search('estimate-064','estimates')).results[0].id,'estimate-064');
 const broad=await search('Generic');eq(broad.hasMore,true);eq(broad.results.length,8);eq(broad.results.every(x=>x.kind==='estimate'),true);
 for(const scope of ['customers','estimates','invoices','jobs']){const r=await search('Synthetic',scope);eq(r.results.every(x=>x.kind===scope.slice(0,-1)),true);}
 for(const q of ["%' OR 1=1 --",'not-found-xyz','%','_'])eq((await search(q)).results.length,0);
 const headers=(await get('6528')).headers;eq(headers.get('cache-control'),'no-store, private');eq(headers.get('vary'),'Cookie');
 fail=true;const down=await get('Synthetic');eq(down.status,503);eq('results' in await down.json(),false);fail=false;
 // Mismatched invoice ownership never yields an invoice result.
 db.prepare("UPDATE invoices SET customer_id='other' WHERE id LIKE '6528%'").run();eq((await search('6528','invoices')).results.length,0);
 // Gated service-address snapshots override current customer addresses.
 db.prepare("INSERT INTO estimate_service_locations(estimate_id,customer_id,address,captured_at) VALUES('estimate-000','c','Historical Service Only Address','2026-10-18')").run();eq((await search('Historical Service','jobs')).results[0].address,'Historical Service Only Address');
 db.prepare("INSERT INTO customer_properties(id,customer_id,address,designation,created_at) VALUES('p','c','Property Lookup Only Address','Rear house','2026-10-18')").run();eq((await search('Property Lookup Only','customers')).results[0].id,'c');
 env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE=undefined;env.FIRE_SERVICE_LOCATIONS_CANDIDATE=undefined;eq((await search('Property Lookup Only','customers')).results.length,0);eq((await search('Historical Service','jobs')).results.length,0);eq((await search('Synthetic QA','jobs')).results[0].address,'456 Synthetic QA Lane');
 const originalNote='Private synthetic prefix. '.repeat(40)+'Need gatecode QA-NOTE-META-12345 <script>literal text</script> after service.';
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES('metadata-note','c',?,'2026-10-18T15:00:00Z')").run(originalNote);
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES('other-note','other','Other customer QA-NOTE-META-12345','2026-10-18T16:00:00Z')").run();
 for(const [id,type,amount,status,reference] of [['meta-payment','Cash',10000,'paid','QA-REF-META-12345'],['meta-tip','Tip',1000,'paid','Tip reference metadata'],['meta-refund','Refund',-2500,'paid','Refund reference metadata'],['meta-pending','Cash',2000,'pending','Pending reference metadata'],['meta-failed','Cash',2000,'failed','Failed reference metadata']])db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,'estimate-000',?,?,?,?, '2026-10-18T15:00:00Z')").run(id,type,amount,status,reference);
 const savedPayments=JSON.stringify(db.prepare('SELECT * FROM payments').all()),savedNotes=JSON.stringify(db.prepare('SELECT * FROM customer_notes').all());
 for(const q of ['qa-ref-meta-12345','REF-META','meta-payment']){const result=await search(q,'payments');eq(result.results[0].id,'meta-payment');eq(result.results[0].customerId,'c');eq(result.results[0].amountCents,10000);eq(result.results[0].kind,'payment');}
 for(const [q,id,status,amount] of [['Tip reference','meta-tip','paid',1000],['Refund reference','meta-refund','paid',-2500],['Pending reference','meta-pending','pending',2000],['Failed reference','meta-failed','failed',2000]]){const row=(await search(q,'payments')).results[0];eq([row.id,row.status,row.amountCents],[id,status,amount]);}
 const notes=(await search('qa-note-meta','notes')).results;eq(notes.length,2);eq(new Set(notes.map(n=>n.customerId)),new Set(['c','other']));const own=notes.find(n=>n.id==='metadata-note');eq(own.excerpt.includes('QA-NOTE-META-12345'),true);eq(own.excerpt.length<=240,true);eq('body' in own,false);eq(JSON.stringify(own).includes(originalNote),false);eq((await search('metadata-note','notes')).results[0].id,'metadata-note');
 eq((await search('REF-META')).results.some(n=>n.kind==='payment'),true);eq((await search('QA-NOTE-META')).results.some(n=>n.kind==='note'),true);
 for(const scope of ['customers','estimates','invoices','jobs'])eq((await search('QA-NOTE-META',scope)).results.length,0);
 eq(JSON.stringify(db.prepare('SELECT * FROM payments').all()),savedPayments);eq(JSON.stringify(db.prepare('SELECT * FROM customer_notes').all()),savedNotes);
 user=null;eq((await get('QA-NOTE-META','notes')).status,401);eq((await get('REF-META','payments')).status,401);user={email:'kylebrooks8605@gmail.com'};
 console.log(`PASS ${checks}/${checks}: actual authorized search, invoice display numbers/IDs/ranking, partial identity/phone/address/services, full-table estimate lookup beyond page one, category limits, literal SQL input, uncached failures, ownership and historical service snapshots. No external or persistent index.`);
}finally{db.close()}
