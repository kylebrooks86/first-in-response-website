/** Actual customer communication route, SQLite send evidence and D1 lost ACK. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())
  db.exec(readFileSync('drizzle/'+name,'utf8'));
let user={email:'kylebrooks8605@gmail.com'},loseAck=false;
const prep=sql=>({sql,values:[],bind(...values){return {...this,values}},
  async first(){return db.prepare(sql).get(...this.values)??null},
  async all(){return {results:db.prepare(sql).all(...this.values)}},
  async run(){const result=db.prepare(sql).run(...this.values);if(loseAck){loseAck=false;throw Error('Synthetic committed message write lost D1 ACK');}return {meta:{changes:Number(result.changes)}}}
});
const env={DB:{prepare:prep,async batch(rows){
  db.exec('BEGIN');
  try{const result=rows.map(row=>({results:db.prepare(row.sql).all(...row.values)}));db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
}}};
const route=createRouteFixtureLoader(process.cwd(),env,()=>user)('app/api/customer-messages/route.ts');
const customerId=randomUUID();
db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(customerId,'Synthetic Message Customer',new Date().toISOString());
const post=body=>route.POST(new Request('https://synthetic.invalid/api/customer-messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const patch=body=>route.PATCH(new Request('https://synthetic.invalid/api/customer-messages',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const list=()=>route.GET(new Request('https://synthetic.invalid/api/customer-messages?customerId='+customerId));
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
const base={customerId,estimateId:'',channel:'text_prepared',template:'custom',body:'Synthetic reminder — no provider delivery',requestId:randomUUID()};
try{
 user=null;eq((await post(base)).status,401);eq((await patch({})).status,401);eq((await list()).status,401);
 user={email:'kylebrooks8605@gmail.com'};
 loseAck=true;
 let response=await post(base);eq(response.status,200);
 let data=await response.json();eq(data.recoveredAfterUncertainPreparation,true);eq(data.deliveryConfirmed,false);
 const preparedId=data.message.id;
 eq(db.prepare('SELECT COUNT(*) AS n FROM customer_messages WHERE id=?').get(preparedId).n,1);
 response=await post(base);eq(response.status,200);eq((await response.json()).duplicate,true);
 response=await post({...base,body:'Conflicting content'});eq(response.status,409);
 response=await list();eq(response.status,200);
 eq((await response.json()).pending.some(row=>row.id===preparedId),true);
 response=await patch({customerId,preparedMessageId:preparedId,ownerConfirmedNotSent:true});
 eq(response.status,200);data=await response.json();
 eq(data.ownerConfirmedSent,false);eq(data.deliveryConfirmed,false);
 eq(data.confirmationSource,'owner');
 response=await patch({customerId,preparedMessageId:preparedId,ownerConfirmedSent:true});
 eq(response.status,409);
 response=await list();eq((await response.json()).pending.some(row=>row.id===preparedId),false);
 const second={...base,requestId:randomUUID(),body:'Synthetic follow-up'};
 response=await post(second);eq(response.status,201);
 const secondId=(await response.json()).message.id;
 response=await patch({customerId,preparedMessageId:secondId,ownerConfirmedSent:true});
 eq(response.status,200);data=await response.json();
 eq(data.ownerConfirmedSent,true);eq(data.deliveryConfirmed,false);
 eq(data.confirmationSource,'owner');
 response=await patch({customerId,preparedMessageId:secondId,ownerConfirmedNotSent:true});
 eq(response.status,409);
 eq(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE id=?").get(secondId+':owner-confirmed').n,1);
 eq(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE id=?").get(secondId+':owner-cancelled').n,0);
 console.log('PASS: '+checks+' actual SQLite customer-message prepare/recover/confirm/cancel checks');
}finally{db.close();}
