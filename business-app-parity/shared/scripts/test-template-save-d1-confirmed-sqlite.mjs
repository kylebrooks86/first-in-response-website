/** FIRE Settings template PUT: actual route + native SQLite confirmation.
 * Only synthetic owner/template records. No hosting, messaging or providers.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db;
const route=rt.load('app/api/message-templates/route.ts');
const key='estimate';let checks=0;
const check=(test,label)=>{assert.ok(test,label);checks++;};
const put=async payload=>{
 const response=await route.PUT(new Request('https://synthetic.invalid/api/message-templates',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({key,...payload})}));
 return{status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};
};
const stored=()=>db.prepare('SELECT key,subject,body,updated_at AS updatedAt FROM message_templates WHERE key=?').get(key);
const serverTemplate=async()=>{const result=await route.GET();return(await result.json()).templates.find(x=>x.key===key);};
const originalPrepare=rt.env.DB.prepare;
try{
 let saved=await put({subject:'  Custom subject  ',body:'  Saved custom owner wording  '});
 check(saved.status===200&&saved.body.template.subject==='Custom subject'&&saved.body.template.body==='Saved custom owner wording',
  'Successful saved template response is exact normalized owner wording');
 check(saved.cache==='no-store, private','Template save receipts cannot be cached');
 check(stored()?.subject==='Custom subject'&&stored()?.body==='Saved custom owner wording'&&
  saved.body.template.updatedAt===stored().updatedAt,
  'Success requires actual durable D1 row and timestamp readback');
 check((await serverTemplate()).body==='Saved custom owner wording',
  'Subsequent real GET uses saved owner customization');
 // Nonthrowing D1 write acknowledgements may still be false. In that case
 // the route must NOT echo the attempted subject as if it were saved.
 const before=JSON.stringify(stored());
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('INSERT INTO message_templates'))return {bind:()=>({run:async()=>({meta:{changes:1},success:true})})};
  return originalPrepare(sql);
 };
 const noWrite=await put({subject:'Not stored',body:'Not stored'});
 check(noWrite.status===503&&noWrite.body.saveUncertain===true,'Nonwriting success-looking SQL ACK fails closed');
 check(JSON.stringify(stored())===before,'Nonwriting ACK cannot change original template');
 rt.env.DB.prepare=originalPrepare;
 // Lost/incorrect SELECT response after a valid transaction is uncertain,
 // not a false success, and the owner can recover via a new GET.
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('SELECT key,subject,body,updated_at AS updatedAt FROM message_templates')){
   return {bind:()=>({first:async()=>({key,subject:'Wrong copy',body:'Wrong copy',updatedAt:'2020-01-01T00:00:00Z'})})};
  }
  return originalPrepare(sql);
 };
 const mismatched=await put({subject:'Actually stored',body:'Actual body after wrong read'});
 check(mismatched.status===503&&mismatched.body.saveUncertain===true,
  'Incorrect post-write readback refuses Template saved');
 rt.env.DB.prepare=originalPrepare;
 check(stored()?.subject==='Actually stored'&&stored()?.body==='Actual body after wrong read',
  'Committed write after lost acknowledgement is recoverable from saved GET');
 check((await serverTemplate()).body==='Actual body after wrong read','Saved GET independently reveals exact committed text');
 const resetAttempt=JSON.stringify(stored());
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('DELETE FROM message_templates'))return {bind:()=>({run:async()=>({meta:{changes:1},success:true})})};
  return originalPrepare(sql);
 };
 const skippedReset=await put({reset:true});
 check(skippedReset.status===503&&skippedReset.body.saveUncertain===true,'Silent failed restore does not report Default restored');
 check(JSON.stringify(stored())===resetAttempt,'Nonwriting DELETE leaves customization retained');
 rt.env.DB.prepare=originalPrepare;
 const restored=await put({reset:true});
 check(restored.status===200&&restored.body.template.key===key&&!stored(),
  'True restore returns success only after original override row is absent');
 const defaultTemplate=await serverTemplate();
 check(defaultTemplate.body!=='Actual body after wrong read','Subsequent GET returns real default after successful restore');
 const repeat=await put({reset:true});
 check(repeat.status===200&&!stored(),'Repeating an already-restored default is harmless and confirmed');
 const invalid=await put({subject:'Invalid',body:'  '});
 check(invalid.status===400&&!stored(),'Empty message content rejected without saving');
 const unknown=await route.PUT(new Request('https://synthetic.invalid/api/message-templates',{method:'PUT',body:JSON.stringify({key:'not-a-real-template',subject:'x',body:'x'})}));
 check(unknown.status===400,'Unknown template key cannot create unrelated metadata');
 rt.setOwner(null);
 const denied=await put({subject:'Not owner',body:'No access'});
 check(denied.status===401&&!stored(),'Nonowner cannot overwrite a template');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 // Failed DB writes are uncertain, not acknowledged as success.
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('INSERT INTO message_templates'))return {bind:()=>({run:async()=>{throw Error('synthetic D1 unavailable');}})};
  return originalPrepare(sql);
 };
 const interrupted=await put({subject:'Disconnected',body:'Do not claim saved'});
 check(interrupted.status===503&&interrupted.body.saveUncertain===true&&!stored(),
  'Interrupted write returns uncertain recovery guidance and no success');
 rt.env.DB.prepare=originalPrepare;
 console.log('PASS '+checks+'/'+checks+' actual Settings templates PUT/native SQLite owner-only readback, reset, no-write, lost acknowledgment and recovery. NO HOSTED OPERATIONS.');
}finally{rt.env.DB.prepare=originalPrepare;db.close();}
