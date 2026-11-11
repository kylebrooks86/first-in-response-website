/** Real FIRE GET/PATCH notifications route on disposable local SQLite.
 * Verifies owner authentication, durable Mark All as Read, re-fetch, replay,
 * mixed read/unread records, and strict separation from business reminders.
 * No hosted database, real account, messages, financial writes or provider.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime();
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS: '+label)};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const stamp='2026-10-20T12:00:00Z';
const route=rt.load('app/api/notifications/route.ts');
const read=async()=>{const r=await route.GET();return{status:r.status,data:await r.json()};};
const patch=async body=>{const r=await route.PATCH(new Request('https://synthetic.invalid/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));return{status:r.status,data:await r.json()};};
const rows=()=>rt.db.prepare('SELECT id,read_at,resolved_at FROM notifications ORDER BY id').all();
const put=(n,readAt=null)=>rt.db.prepare('INSERT INTO notifications(id,type,title,body,read_at,created_at) VALUES (?,?,?,?,?,?)')
  .run(id(n),'estimate_viewed','Synthetic activity '+n,'No customer data',readAt,stamp);
try{
 put(1);put(2);put(3,'2026-10-19T12:00:00Z');
 const start=await read();
 check(start.status===200&&start.data.unread===2&&start.data.notifications.length===3,
   'Actual authenticated GET reports exactly two unread and one saved read notification');
 const originalRead=rows().find(x=>x.id===id(3)).read_at;
 const bad=await patch({all:true,id:id(1)});
 check(bad.status===400&&rows().filter(x=>x.read_at===null).length===2,
   'Mixed mark-all and one-record action is rejected with no writes');
 const nonBoolean=await patch({all:1});
 check(nonBoolean.status===400&&rows().filter(x=>x.read_at===null).length===2,
   'Invalid mark-all value cannot change read state');
 rt.setOwner(null);
 const denied=await patch({all:true}),unreadDenied=await read();
 check(denied.status===401&&unreadDenied.status===401&&rows().filter(x=>x.read_at===null).length===2,
   'Unknown owner cannot inspect or mark anyone\'s activity as read');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 const first=await patch({all:true});
 check(first.status===200&&first.data.ok===true&&first.data.unread===0&&typeof first.data.readAt==='string',
   'Mark All returns success only after actual local database confirmation');
 const saved=rows();
 check(saved.every(x=>x.read_at!==null),'Both formerly unread entries are physically marked read');
 check(saved.every(x=>x.resolved_at===null),'Mark All never resolves separate tasks/financial exceptions');
 check(saved.find(x=>x.id===id(3)).read_at===originalRead,
   'Already-read historical timestamp is unchanged');
 const refreshed=await read();
 check(refreshed.status===200&&refreshed.data.unread===0&&
       refreshed.data.notifications.every(x=>x.readAt!==null),
       'Refreshing the actual GET after Mark All preserves zero unread on storage');
 const replay=await patch({all:true});
 check(replay.status===200&&replay.data.unread===0&&JSON.stringify(rows())===JSON.stringify(saved),
   'Repeated Mark All is idempotent and does not update old timestamps');
 put(4);
 const newEvent=await read();
 check(newEvent.data.unread===1&&newEvent.data.notifications.some(x=>x.id===id(4)&&x.readAt===null),
   'New unread activity after Mark All is visible instead of globally suppressed');
 const one=await patch({id:id(4)});
 check(one.status===200&&rows().find(x=>x.id===id(4)).read_at!==null,
   'Marking a single newly arrived notification is persisted');
 check((await read()).data.unread===0,'Second reload retains correct unread count after individual mark');
 const previous=JSON.stringify(rows());
 const missing=await patch({id:id(99)});
 check(missing.status===404&&JSON.stringify(rows())===previous,
   'Missing notification cannot claim successful mark or alter other records');
 // A regular notification's resolve action must produce a verified saved
 // resolution (not just an uninspected SQLite write ACK).
 put(6);
 const resolved=await patch({id:id(6),resolve:true});
 const savedResolution=rows().find(x=>x.id===id(6));
 check(resolved.status===200&&resolved.data.ok===true&&
       resolved.data.resolvedAt===savedResolution.resolved_at&&
       resolved.data.readAt===savedResolution.read_at&&Boolean(savedResolution.resolved_at),
   'Normal notification resolution returns persisted SQLite read and resolve timestamps');
 const resolvedReplay=await patch({id:id(6),resolve:true});
 check(resolvedReplay.status===200&&resolvedReplay.data.resolvedAt===savedResolution.resolved_at&&
       rows().find(x=>x.id===id(6)).resolved_at===savedResolution.resolved_at,
   'Repeated resolution preserves the original resolved timestamp');
 const missingResolution=await patch({id:id(99),resolve:true});
 check(missingResolution.status===404,'Missing notification cannot claim a successful resolution');
 put(7);
 rt.db.prepare("UPDATE notifications SET type='payment_overage' WHERE id=?").run(id(7));
 const guardedResolution=await patch({id:id(7),resolve:true});
 check(guardedResolution.status===409&&rows().find(x=>x.id===id(7)).resolved_at===null,
   'Ordinary resolve cannot bypass the payment-overage reconciliation requirement');
 const failedResolutionPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){
   if(sql.includes("UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=COALESCE(resolved_at,?)"))
     return {bind:()=>({first:async()=>null})};
   return failedResolutionPrepare(sql);
 };
 put(8);
 const unresolved=await patch({id:id(8),resolve:true});
 check(unresolved.status===503&&unresolved.data.saveUncertain===true&&
       rows().find(x=>x.id===id(8)).resolved_at===null,
   'A nonthrowing but unconfirmed resolution refuses false success');
 rt.env.DB.prepare=failedResolutionPrepare;
 const originalPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){if(sql.includes('UPDATE notifications SET read_at=? WHERE read_at IS NULL'))throw Error('Synthetic SQLite unavailable');return originalPrepare(sql);};
 put(5);
 const failure=await patch({all:true});
 check(failure.status===500&&rows().find(x=>x.id===id(5)).read_at===null,
   'Failed storage update never returns false success or clears unread');
 rt.env.DB.prepare=originalPrepare;
 const recovered=await read();
 const remainingUnread=rows().filter(row=>row.read_at===null).length;
 check(recovered.status===200&&remainingUnread===3&&recovered.data.unread===remainingUnread,
   'After an interrupted update, the real GET still reports every pending notification');

 // Exercise the ACTUAL disaster-recovery route against the same disposable
 // SQLite store, not an approximation of its SQL. No hosted DR touched.
 const dr=rt.load('../../fire-app-dr/app/api/notifications/route.ts');
 const drRead=async()=>{const r=await dr.GET();return {status:r.status,data:await r.json(),headers:r.headers};};
 const drPatch=async body=>{const r=await dr.PATCH(new Request('https://synthetic.invalid/api/notifications',{
   method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 }));return {status:r.status,data:await r.json()};};
 for(let n=100;n<151;n++)put(n);
 const expectedUnread=rows().filter(row=>row.read_at===null).length;
 const drStart=await drRead();
 check(drStart.status===200&&drStart.data.notifications.length===40&&
       drStart.data.unread===expectedUnread&&expectedUnread>40&&
       drStart.headers.get('cache-control')==='no-store, private',
   'Real DR GET counts every unread notification, even when the visible list stops at 40');
 const drMixed=await drPatch({all:true,id:id(100)});
 check(drMixed.status===400&&rows().filter(row=>row.read_at===null).length===expectedUnread,
   'DR refuses conflicting mark-all and single-notification actions without writes');
 const drInvalid=await drPatch({all:1});
 check(drInvalid.status===400&&rows().filter(row=>row.read_at===null).length===expectedUnread,
   'DR rejects nonboolean mark-all requests before changing records');
 const drAll=await drPatch({all:true});
 check(drAll.status===200&&drAll.data.unread===0&&rows().every(row=>row.read_at!==null)&&
       rows().find(row=>row.id===id(7)).resolved_at===null,
   'DR Mark All confirms all read rows without clearing unresolved payment alerts');
 put(201);
 const drSingle=await drPatch({id:id(201)});
 check(drSingle.status===200&&drSingle.data.readAt===rows().find(row=>row.id===id(201)).read_at,
   'DR individual read reports the persisted timestamp');
 const drMissing=await drPatch({id:id(999)});
 check(drMissing.status===404,'DR refuses false success for a missing notification');
 put(202);
 const drResolve=await drPatch({id:id(202),resolve:true});
 const drSaved=rows().find(row=>row.id===id(202));
 check(drResolve.status===200&&drResolve.data.resolvedAt===drSaved.resolved_at&&
       drResolve.data.readAt===drSaved.read_at&&Boolean(drSaved.resolved_at),
   'DR resolution returns an independently persisted read and resolve receipt');
 const drReplay=await drPatch({id:id(202),resolve:true});
 check(drReplay.status===200&&drReplay.data.resolvedAt===drSaved.resolved_at,
   'DR repeated resolution preserves the original timestamp');
 const drGuarded=await drPatch({id:id(7),resolve:true});
 check(drGuarded.status===409&&rows().find(row=>row.id===id(7)).resolved_at===null,
   'DR normal notification action cannot dismiss payment-overage exceptions');
 const drOriginalPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){
   if(sql.includes("UPDATE notifications SET read_at=COALESCE(read_at,?), resolved_at=COALESCE(resolved_at,?)"))
     return {bind:()=>({first:async()=>null})};
   return drOriginalPrepare(sql);
 };
 put(203);
 const drFailed=await drPatch({id:id(203),resolve:true});
 check(drFailed.status===503&&drFailed.data.saveUncertain===true&&
       rows().find(row=>row.id===id(203)).resolved_at===null,
   'DR unconfirmed SQLite response does not claim resolution success');
 rt.env.DB.prepare=drOriginalPrepare;
}finally{rt.db.close();}
console.log('PASS '+checks+' actual notifications route/SQLite persistence, isolation and recovery assertions. NO HOSTED OPERATIONS.');
