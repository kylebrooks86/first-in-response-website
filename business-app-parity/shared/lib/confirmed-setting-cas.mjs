/**
 * Durable owner settings: optimistic CAS plus authoritative D1 readback.
 *
 * Never claim a saved price, discount, quote mix or reminder preference merely
 * from a D1 UPDATE/INSERT acknowledgement. The write may commit and its ACK
 * disappear; alternatively, an apparently successful ACK may not be durable.
 *
 * The expected body contains a NEW unpredictable revision from the caller,
 * so a matching exact body proves that particular attempted update was saved.
 * Keep the original CAS predicate: don't overwrite another owner's newer edit.
 *
 * No network/provider clients, retries or environment secrets in this module.
 */
export async function confirmedSettingCAS(db,{key,previousBody,encoded,updatedAt}){
 if(typeof key!=='string'||!key||typeof encoded!=='string'||!encoded||
    (previousBody!==null&&typeof previousBody!=='string')||
    typeof updatedAt!=='string'||!updatedAt||
    !db||typeof db.prepare!=='function')
   return Object.freeze({status:'uncertain',recoveredAfterUncertainSave:false});
 let acknowledged=false;
 try{
  const write=previousBody===null
   ?await db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING")
     .bind(key,encoded,updatedAt).run()
   :await db.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?')
     .bind(encoded,updatedAt,key,previousBody).run();
  acknowledged=write?.success!==false&&write?.meta?.changes===1;
 }catch{/* The database may already have committed. Never blind-retry the write. */}
 let persisted;
 try{
  persisted=await db.prepare('SELECT body FROM message_templates WHERE key=?')
    .bind(key).first();
 }catch{return Object.freeze({status:'uncertain',recoveredAfterUncertainSave:false});}
 // A concurrent edit that replaced this revision must not be silently
 // overridden or represented as current after a stale response.
 if(persisted&&typeof persisted.body==='string'&&persisted.body===encoded)
  return Object.freeze({status:'confirmed',recoveredAfterUncertainSave:!acknowledged});
 if(persisted&&typeof persisted.body==='string')
  return Object.freeze({status:'conflict',recoveredAfterUncertainSave:false});
 return Object.freeze({status:'uncertain',recoveredAfterUncertainSave:false});
}
