/** G5-03 actual notification GET and permanent number resolution, disposable SQLite only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
import {jobNumberLabelForEstimate,JOB_REFERENCE_BY_INVOICE_SQL} from '../lib/job-numbering.mjs';
const rt=stackedRuntime(),db=rt.db;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const stamp='2026-10-20T12:00:00Z';
try {
 db.exec(readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8'));
 db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 rt.env.FIRE_CUSTOMER_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 rt.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const quote=n=>({requestId:id(n),customer:'Synthetic '+n,email:'test'+n+'@example.invalid',phone:'918555'+String(n).padStart(4,'0'),address:n+' Synthetic Way',items:[{name:'Custom Service',description:'Synthetic',quantity:1,unit:'job',totalCents:2500}],appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0});
 for(const n of [1,2]){const response=await rt.post(quote(n));assert.equal(response.status,201);assert.equal((await response.json()).jobNumber,n);}
 const customer=n=>db.prepare('SELECT customer_id FROM estimates WHERE id=?').get(id(n)).customer_id;
 for(const n of [1,2]){
  db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES(?,?,?,'sent',2500,?,?)").run(id(n+10),id(n),customer(n),'synthetic-invoice-'+n,stamp);
  db.prepare("INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) VALUES(?,'invoice_viewed','Synthetic','Synthetic',?,?,?)").run(id(n+20),customer(n),id(n),stamp);
 }
 const route=rt.load('app/api/notifications/route.ts');
 const result=await route.GET();assert.equal(result.status,200);
 const rows=(await result.json()).notifications;
 for(const n of [1,2]){
  const row=rows.find(x=>x.id===id(n+20));assert.ok(row);
  assert.equal(row.customerId,customer(n));assert.equal(row.estimateId,id(n));assert.equal(row.invoiceId,id(n+10));
  assert.equal(await jobNumberLabelForEstimate(rt.env.DB,row.estimateId),'Job #000'+n);
  assert.equal(db.prepare(JOB_REFERENCE_BY_INVOICE_SQL).get(row.invoiceId).jobNumber,n);
 }
 db.prepare("UPDATE notifications SET customer_id=? WHERE id=?").run(customer(2),id(21));
 const mismatch=(await (await route.GET()).json()).notifications.find(x=>x.id===id(21));
 assert.equal(mismatch.invoiceId,null,'Mismatched notification owner cannot resolve invoice');
 const before=rt.counters();rt.setOwner(null);assert.equal((await route.GET()).status,401);assert.deepEqual(rt.counters(),before);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,2);
 const ui=readFileSync('app/dashboard.tsx','utf8');
 assert.ok(ui.includes('onNavigate(destination,item.estimateId,item.type.startsWith("invoice_")?item.invoiceId:null,item.customerId)'));
 console.log('PASS G5 notification GET -> saved estimate/invoice -> permanent Job #, two distinct customers, mismatched invoice suppression, anonymous denial and no extra serials; local only');
} finally {db.close();}
