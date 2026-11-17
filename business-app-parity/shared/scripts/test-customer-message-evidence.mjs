/** Actual customer communication route, SQLite send evidence and D1 lost ACK. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())
  db.exec(readFileSync('drizzle/'+name,'utf8'));
let user={email:'kylebrooks8605@gmail.com'},loseAck=false,loseBatchAck=false;
let raceAppointment=null;
const prep=sql=>({sql,values:[],bind(...values){return {...this,values}},
  async first(){return db.prepare(sql).get(...this.values)??null},
  async all(){return {results:db.prepare(sql).all(...this.values)}},
  async run(){
    // Simulate a separate owner device changing the scheduled job exactly
    // after the route's initial SELECT but before its conditional INSERT.
    if(raceAppointment&&sql.includes('INSERT OR IGNORE INTO customer_messages')){
      const race=raceAppointment;raceAppointment=null;
      db.prepare('UPDATE estimates SET status=?,scheduled_at=? WHERE id=?')
        .run(race.status,race.scheduledAt,race.id);
    }
    const result=db.prepare(sql).run(...this.values);if(loseAck){loseAck=false;throw Error('Synthetic committed message write lost D1 ACK');}return {meta:{changes:Number(result.changes)}}}
});
const env={DB:{prepare:prep,async batch(rows){
  db.exec('BEGIN');
  try{const result=rows.map(row=>({results:db.prepare(row.sql).all(...row.values)}));db.exec('COMMIT');if(loseBatchAck){loseBatchAck=false;throw Error('Synthetic committed confirmation batch lost D1 ACK');}return result;}
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
 for(const method of ['POST','PATCH']){
  for(const raw of ['null','[]','42','"string"','{invalid','']){
   const before=db.prepare('SELECT COUNT(*) AS n FROM customer_messages').get().n;
   const response=await route[method](new Request('https://synthetic.invalid/api/customer-messages',
    {method,headers:{'Content-Type':'application/json'},body:raw}));
   eq(response.status,400);
   eq(db.prepare('SELECT COUNT(*) AS n FROM customer_messages').get().n,before);
  }
 }
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
 loseBatchAck=true;
 response=await patch({customerId,preparedMessageId:secondId,ownerConfirmedSent:true});
 eq(response.status,200);data=await response.json();
 eq(data.ownerConfirmedSent,true);eq(data.deliveryConfirmed,false);
 eq(data.recoveredAfterUncertainConfirmation,true);
 eq(data.confirmationSource,'owner');
 response=await patch({customerId,preparedMessageId:secondId,ownerConfirmedNotSent:true});
 eq(response.status,409);
 eq(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE id=?").get(secondId+':owner-confirmed').n,1);
 eq(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE id=?").get(secondId+':owner-cancelled').n,0);
 // Server-side protection: the browser is not authoritative when a job is
 // completed, moved, expired or another tab bypasses the composer controls.
 const appointmentId=randomUUID();
 const future=()=>new Date(Date.now()+86400000).toISOString();
 const past=()=>new Date(Date.now()-86400000).toISOString();
 const firstFuture=future();
 db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at,scheduled_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(appointmentId,customerId,'scheduled',20000,20000,10000,new Date().toISOString(),firstFuture);
 const appointment={customerId,estimateId:appointmentId,channel:'text_prepared',template:'appointment',body:'Synthetic appointment confirmation',requestId:randomUUID(),appointmentScheduledAt:firstFuture};
 const appointmentCount=()=>db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE template IN ('appointment','appointmentReminder')").get().n;
 const none=appointmentCount();
 eq((await post({...appointment,estimateId:'',requestId:randomUUID()})).status,409);
 eq(appointmentCount(),none);
 eq((await post({...appointment,appointmentScheduledAt:'',requestId:randomUUID()})).status,409);
 eq(appointmentCount(),none);
 db.prepare('UPDATE estimates SET status=? WHERE id=?').run('draft',appointmentId);
 eq((await post(appointment)).status,409);
 eq(appointmentCount(),none);
 const prior=past();
 db.prepare('UPDATE estimates SET status=?,scheduled_at=? WHERE id=?').run('scheduled',prior,appointmentId);
 appointment.appointmentScheduledAt=prior;
 eq((await post(appointment)).status,409);
 eq(appointmentCount(),none);
 db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run('not-an-appointment',appointmentId);
 appointment.appointmentScheduledAt='not-an-appointment';
 eq((await post(appointment)).status,409);
 eq(appointmentCount(),none);
 const upcoming=future();
 db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(upcoming,appointmentId);
 appointment.appointmentScheduledAt=upcoming;
 eq((await post(appointment)).status,201);
 eq(appointmentCount(),none+1);
 // An owner preview cannot survive a reschedule to another *future* time.
 const moved=new Date(Date.now()+2*86400000).toISOString();
 db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(moved,appointmentId);
 eq((await post({...appointment,requestId:randomUUID()})).status,409);
 eq(appointmentCount(),none+1);
 // Retries cannot reopen a stale prepared appointment as a new handoff.
 db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(past(),appointmentId);
 eq((await post(appointment)).status,409);
 eq(appointmentCount(),none+1);
 const reminderTime=future();
 db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(reminderTime,appointmentId);
 const reminder={...appointment,appointmentScheduledAt:reminderTime,template:'appointmentReminder',requestId:randomUUID(),body:'Synthetic 24-hour reminder'};
 eq((await post(reminder)).status,201);
 // A second device can change the saved job after the first SELECT but before
 // the SQL INSERT. Only the SQLite-time guard may authorize the draft.
 const raceDraft={...appointment,appointmentScheduledAt:reminderTime,requestId:randomUUID(),body:'Raced appointment text'};
 raceAppointment={id:appointmentId,status:'completed',scheduledAt:reminderTime};
 eq((await post(raceDraft)).status,409);
 eq(raceAppointment,null);
 eq(appointmentCount(),none+2);
 const raceTime=future();
 db.prepare('UPDATE estimates SET status=?,scheduled_at=? WHERE id=?').run('scheduled',raceTime,appointmentId);
 raceAppointment={id:appointmentId,status:'scheduled',scheduledAt:past()};
 eq((await post({...raceDraft,appointmentScheduledAt:raceTime,requestId:randomUUID(),body:'Raced expired appointment'})).status,409);
 eq(appointmentCount(),none+2);
 const freshFuture=future();
 db.prepare('UPDATE estimates SET status=?,scheduled_at=? WHERE id=?').run('scheduled',freshFuture,appointmentId);
 raceAppointment={id:appointmentId,status:'scheduled',scheduledAt:new Date(Date.now()+3*86400000).toISOString()};
 eq((await post({...raceDraft,appointmentScheduledAt:freshFuture,requestId:randomUUID(),body:'Raced rescheduled appointment'})).status,409);
 eq(raceAppointment,null);
 eq(appointmentCount(),none+2);
 // A genuinely custom follow-up remains available after the job ends.
 eq((await post({...appointment,template:'custom',body:'Please call when convenient',requestId:randomUUID()})).status,201);
 eq(readFileSync('app/dashboard.tsx','utf8').includes('appointmentScheduledAt:estimate?.scheduledAt??""'),true);
 console.log('PASS: '+checks+' actual SQLite customer-message prepare/recover/confirm/cancel + stale appointment SQL-time race checks');
}finally{db.close();}
