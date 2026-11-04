/** Confirm actual final invoice POST with disposable native SQLite.
 * No hosted database, payments, Stripe, or external network access.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let checks=0,owner={email:'kylebrooks8605@gmail.com'},behavior='normal',mutations=0,writeId=null,readbackMode='normal',remote=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const query=(sql,args=[])=>({sql,args,bind(...a){return query(sql,a)},
 async first(){
  let row=db.prepare(sql).get(...args)??null;
  if(sql.startsWith('SELECT id,estimate_id AS estimateId,customer_id AS customerId,status,subtotal_cents')){
   if(readbackMode==='missing'){readbackMode='normal';return null;}
   if(readbackMode==='mismatched'&&row){readbackMode='normal';return {...row,totalCents:row.totalCents+1};}
   if(readbackMode==='throws'){readbackMode='normal';throw Error('Synthetic D1 read lost');}
  }
  return row;
 },
 async all(){
  let rows=db.prepare(sql).all(...args);
  if(readbackMode==='missing-line'&&sql.startsWith('SELECT id,name,description,quantity,unit,total_cents')){
   readbackMode='normal';return{results:rows.slice(0,-1)};
  }
  if(readbackMode==='wrong-line'&&sql.startsWith('SELECT id,name,description,quantity,unit,total_cents')){
   readbackMode='normal';return{results:[{...rows[0],name:'Not saved scope'},...rows.slice(1)]};
  }
  return {results:rows};
 },
 async run(){mutations++;return {success:true,meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
});
const env={DB:{prepare:query,async batch(statements){
 if(behavior==='uncommitted'){behavior='normal';return statements.map(()=>({success:true,meta:{changes:0}}));}
 const lost=behavior==='commit-throw',fail=behavior==='missing-line',mismatch=behavior==='wrong-line';
 behavior='normal';db.exec('BEGIN');
 try{const results=statements.map(statement=>{mutations++;return{success:true,meta:{changes:Number(db.prepare(statement.sql).run(...statement.args).changes)}}});db.exec('COMMIT');
  if(fail)readbackMode='missing-line';if(mismatch)readbackMode='wrong-line';
  if(lost)throw Error('Synthetic lost D1 acknowledgement after COMMIT');
  return results;
 }catch(error){try{db.exec('ROLLBACK')}catch{}throw error;}
}}};
const fetchBefore=globalThis.fetch;globalThis.fetch=async()=>{remote++;throw Error('External network forbidden')};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner),route=load('app/api/invoices/route.ts'),detail=load('app/api/invoices/[id]/route.ts');
const add=(id,customer='synthetic-customer',total=22575)=>{db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,customer,'now');db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',29500,6925,?,11288,'now')").run('e-'+id,'c-'+id,total);for(const [n,name,description,qty,unit,cents] of [[0,'House Wash','Original house wash',1000,'sq ft',22000],[1,'Gutter Cleaning','Original gutter scope',50,'linear ft',7500]])db.prepare('INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,?,?,?,?,?)').run('ei-'+id+'-'+n,'e-'+id,name,description,qty,unit,cents)};
const post=id=>route.POST(new Request('https://synthetic.invalid/api/invoices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({estimateId:'e-'+id})}));
const rows=id=>db.prepare('SELECT * FROM invoices WHERE estimate_id=?').all('e-'+id);
try{
 add('normal');
 let response=await post('normal'),receipt=await response.json();
 eq(response.status,201,'Actual D1 persisted initial create returns 201');
 eq(receipt.totalCents,22575,'Exact quote total used, not the full subtotal');
 eq(receipt.subtotalCents,29500,'Original service subtotal');
 eq(receipt.discountCents,6925,'Original entire discount preserved');
 eq(receipt.items.length,2,'Real saved invoice item rows returned');
 eq(new Set(receipt.items.map(i=>i.id)).size,2,'Two actual distinct invoice service UUIDs');
 eq(receipt.items.reduce((a,i)=>a+Number(i.totalCents),0),29500,'Invoice scope totals exactly');
 eq(receipt.items.map(i=>i.name),['House Wash','Gutter Cleaning'],'Original quote service names remain');
 const saved=await detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:receipt.id})});
 eq((await saved.json()).invoice.items.map(i=>i.id),receipt.items.map(i=>i.id),'Independent invoice detail preserves the same UUIDs');
 response=await post('normal');eq(response.status,200,'Same job replay reads existing invoice');
 eq((await response.json()).id,receipt.id,'Replay returns original invoice, never creates duplicate');
 eq(rows('normal').length,1,'Database has exactly one invoice');
 add('zero');
 behavior='uncommitted';response=await post('zero');const noWrite=await response.json();
 eq(response.status,503,'D1 reported zero writes cannot claim an invoice');
 eq(noWrite.saveUncertain,true,'Failure states uncertain, never claims a confirmed save');
 eq(rows('zero').length,0,'Uncommitted batch persisted nothing');
 response=await post('zero');eq(response.status,201,'Owner can safely reopen and create after actual 0 write');
 add('committed');
 behavior='commit-throw';response=await post('committed');
 eq(response.status,200,'Lost acknowledgement after COMMIT recovers exact already saved invoice');
 const recovered=await response.json();
 eq(recovered.existing,true,'Recovered result is existing, not a duplicate 201');
 eq(rows('committed').length,1,'Only one invoice after lost ACK');
 add('mismatch');
 behavior='wrong-line';response=await post('mismatch');eq(response.status,503,'False line readback prevents 201');
 eq((await response.json()).saveUncertain,true,'Incorrect line response not confirmed');
 eq(rows('mismatch').length,1,'Invoice may have committed before failed readback');
 response=await post('mismatch');eq(response.status,200,'Safe reopen read confirms already persisted invoice');
 eq(rows('mismatch').length,1,'Reopen never duplicates invoice');
 add('incomplete');
 behavior='missing-line';response=await post('incomplete');eq(response.status,503,'Incomplete readback prevents 201');
 response=await post('incomplete');eq(response.status,200,'After complete read prior invoice confirmed');
 add('altered');
 response=await post('altered');eq(response.status,201,'Seed invoice for later manual change');
 const original=await response.json();
 db.prepare("UPDATE invoice_items SET total_cents=2000 WHERE invoice_id=? AND name='House Wash'").run(original.id);
 db.prepare("UPDATE invoices SET subtotal_cents=9500,discount_cents=0,discount_value=0,total_cents=9500 WHERE id=?").run(original.id);
 response=await post('altered');eq(response.status,200,'Legitimate later invoice revision is not forced back to original estimate value');
 eq((await response.json()).id,original.id,'Invoice replay retains original ID after revision');
 add('corrupt');
 response=await post('corrupt');eq(response.status,201,'Seed invoice for corruption case');
 db.prepare("DELETE FROM invoice_items WHERE invoice_id=(SELECT id FROM invoices WHERE estimate_id=?)").run('e-corrupt');
 response=await post('corrupt');eq(response.status,409,'Broken saved invoice line set is not returned as confirmed');
 add('invalid-total','synthetic',30000);
 const before=mutations;response=await post('invalid-total');
 eq(response.status,409,'Original estimate cannot exceed actual saved service scope');
 eq(mutations,before,'Incorrect original subtotal cannot create invoice');
 owner={email:'intruder@example.invalid'};response=await post('normal');
 eq(response.status,401,'Nonowner cannot request invoice');
 eq(remote,0,'No external provider or Stripe calls');
 console.log('PASS '+checks+'/'+checks+' actual invoice-create native SQLite: stored header/lines/UUIDs, zero-write ACK, lost-commit ACK, incomplete readback, revision replay, corrupted data, auth and no remote calls.');
}finally{globalThis.fetch=fetchBefore;db.close();}
