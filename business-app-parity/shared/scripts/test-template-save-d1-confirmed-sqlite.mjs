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
 return{status:response.status,body:await response.json(),cache:response.headers.get('cache-control'),vary:response.headers.get('vary'),nosniff:response.headers.get('x-content-type-options')};
};
const stored=()=>db.prepare('SELECT key,subject,body,updated_at AS updatedAt FROM message_templates WHERE key=?').get(key);
const serverTemplate=async()=>{const result=await route.GET();return(await result.json()).templates.find(x=>x.key===key);};
const originalPrepare=rt.env.DB.prepare;
try{
 let saved=await put({subject:'  Custom subject  ',body:'  Saved custom owner wording  '});
 check(saved.status===200&&saved.body.template.subject==='Custom subject'&&saved.body.template.body==='Saved custom owner wording',
  'Successful saved template response is exact normalized owner wording');
 check(saved.cache==='private, no-store'&&saved.vary==='Cookie'&&saved.nosniff==='nosniff','Successful template write receipt is private, session-varying and nosniff');
 check(stored()?.subject==='Custom subject'&&stored()?.body==='Saved custom owner wording'&&
  saved.body.template.updatedAt===stored().updatedAt,
  'Success requires actual durable D1 row and timestamp readback');
 check((await serverTemplate()).body==='Saved custom owner wording',
  'Subsequent real GET uses saved owner customization');
 // The reset button sends a literal boolean TRUE; malformed API clients
 // must not interpret "false", 1, [] or a mixed save/reset as permission to
 // destroy a durable owner customization. Verify actual SQLite is untouched.
 const preserved=JSON.stringify(stored());
 for(const [label,payload] of [
  ['string false reset',{reset:'false'}],
  ['numeric reset',{reset:1}],
  ['object reset',{reset:{force:false}}],
  ['array reset',{reset:[]}],
  ['mixed reset/edit',{reset:true,body:'Discard this text'}],
  ['unknown field',{subject:'X',body:'X',erase:true}],
  ['object subject',{subject:{value:'X'},body:'Normal message'}],
  ['object message',{subject:'Normal',body:{value:'X'}}],
  ['missing message',{subject:'Normal'}],
  ['false reset without message',{reset:false}],
 ]){
   const result=await put(payload);
   check(result.status===400&&JSON.stringify(stored())===preserved,
     'Malformed '+label+' cannot delete or modify saved SQLite template');
 }
 // A saved owner GET must fail closed when its D1 metadata read is unavailable.
 rt.env.DB.prepare=function(sql){if(sql.startsWith('SELECT key,subject,body,updated_at AS updatedAt FROM message_templates'))throw Error('Synthetic D1 template read unavailable');return originalPrepare(sql);};
 const readOutage=await route.GET();
 check(readOutage.status===503&&readOutage.headers.get('cache-control')==='private, no-store'&&readOutage.headers.get('vary')==='Cookie'&&readOutage.headers.get('x-content-type-options')==='nosniff'&&
   JSON.stringify(stored())===preserved,'D1 outage returns controlled private 503 without inventing an empty template list');
 rt.env.DB.prepare=originalPrepare;
 const ownerGet=await route.GET();
 check(ownerGet.status===200&&ownerGet.headers.get('cache-control')==='private, no-store'&&
   ownerGet.headers.get('vary')==='Cookie'&&
   ownerGet.headers.get('x-content-type-options')==='nosniff',
   'Owner-authored template reads cannot be cached or MIME-sniffed');
 rt.setOwner(null);
 const foreignGet=await route.GET();
 check(foreignGet.status===401&&foreignGet.headers.get('cache-control')==='private, no-store'&&
   JSON.stringify(stored())===preserved,
   'Anonymous template read is unauthorized and never changes saved copy');
 for(const identity of [{},{email:null},{email:42},{get email(){throw Error('Synthetic owner email getter failure');}}]){
  rt.setOwner(identity);
  const before=rt.counters();
  const deniedRead=await route.GET();
  const deniedWrite=await put({subject:'Unauthorized',body:'Must not save'});
  check(deniedRead.status===401&&deniedWrite.status===401,'Malformed template owner cannot read or write');
  check(deniedRead.headers.get('cache-control')==='private, no-store'&&deniedRead.headers.get('vary')==='Cookie'&&deniedRead.headers.get('x-content-type-options')==='nosniff',
   'Malformed owner template read is private and MIME-safe');
  check(deniedWrite.cache==='private, no-store'&&deniedWrite.vary==='Cookie'&&deniedWrite.nosniff==='nosniff',
   'Malformed owner template mutation 401 is private before any D1 activity');
  check(JSON.stringify(rt.counters())===JSON.stringify(before),'Malformed template principal performs no D1 reads/writes');
 }
 rt.setOwner({email:'kylebrooks8605@gmail.com'});

 // A real D1 COMMIT can succeed and the INSERT acknowledgment still throw.
 // Readback must recover exactly the just-committed owner template.
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('INSERT INTO message_templates'))return {bind(...args){return {run:async()=>{
   await originalPrepare(sql).bind(...args).run();
   throw Error('Synthetic D1 lost INSERT acknowledgement after commit');
  }};}};
  return originalPrepare(sql);
 };
 const committedDespiteLostWrite=await put({subject:'Saved despite lost ACK',body:'Actual committed owner wording'});
 check(committedDespiteLostWrite.status===200&&committedDespiteLostWrite.body.template.subject==='Saved despite lost ACK'&&
  committedDespiteLostWrite.body.template.body==='Actual committed owner wording',
  'Committed template INSERT with lost ACK is confirmed by the real stored row');
 check((await serverTemplate()).body==='Actual committed owner wording',
  'Independent GET returns precisely the recovered updated template');
 rt.env.DB.prepare=originalPrepare;
 // Nonthrowing D1 write acknowledgements may still be false. In that case
 // the route must NOT echo the attempted subject as if it were saved.
 const before=JSON.stringify(stored());
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('INSERT INTO message_templates'))return {bind:()=>({run:async()=>({meta:{changes:1},success:true})})};
  return originalPrepare(sql);
 };
 const noWrite=await put({subject:'Not stored',body:'Not stored'});
 check(noWrite.status===503&&noWrite.body.saveUncertain===true&&noWrite.cache==='private, no-store'&&noWrite.vary==='Cookie'&&noWrite.nosniff==='nosniff',
   'Nonwriting success-looking SQL ACK fails closed with private uncertain receipt');
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
 // The DELETE was persisted but its ACK never reached the app.
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('DELETE FROM message_templates'))return {bind(...args){return {run:async()=>{
   await originalPrepare(sql).bind(...args).run();
   throw Error('Synthetic D1 lost DELETE acknowledgement after commit');
  }};}};
  return originalPrepare(sql);
 };
 const recoveredDefault=await put({reset:true});
 check(recoveredDefault.status===200&&recoveredDefault.body.template.key===key&&!stored(),
  'Committed reset with lost DELETE ACK succeeds only after absence readback');
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
 const malformed=await route.PUT(new Request('https://synthetic.invalid/api/message-templates',{method:'PUT',body:'{not-json'}));
 check(malformed.status===400&&malformed.headers.get('cache-control')==='private, no-store'&&malformed.headers.get('vary')==='Cookie'&&malformed.headers.get('x-content-type-options')==='nosniff',
   'Malformed owner template request returns private actionable 400 instead of throwing');
 const arrayPayload=await route.PUT(new Request('https://synthetic.invalid/api/message-templates',{method:'PUT',body:'[]'}));
 check(arrayPayload.status===400,'Array payload cannot change message templates');
 const unknown=await route.PUT(new Request('https://synthetic.invalid/api/message-templates',{method:'PUT',body:JSON.stringify({key:'not-a-real-template',subject:'x',body:'x'})}));
 check(unknown.status===400&&unknown.headers.get('cache-control')==='private, no-store'&&unknown.headers.get('vary')==='Cookie'&&unknown.headers.get('x-content-type-options')==='nosniff',
   'Unknown template key returns private 400 and cannot create unrelated metadata');
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
 console.log('PASS '+checks+'/'+checks+' actual Settings templates PUT/native SQLite owner-only readback, committed lost INSERT/DELETE ACK recovery, reset, no-write, malformed input and interrupted confirmation. NO HOSTED OPERATIONS.');
}finally{rt.env.DB.prepare=originalPrepare;db.close();}
