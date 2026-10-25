import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {DOOR_BOOK_KEY,decodeDoorBook,validDoorBook,houseKey,doorId,doorStatus,latestDoorVisit,doorSuppressed,validDoorFollowUpDate,validDoorPoint} from '../../../lib/door-knocking';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
async function authorized(){return (await getChatGPTUser())?.email.toLowerCase()==='kylebrooks8605@gmail.com';}
export async function GET(){
 if(!await authorized())return json({error:'Unauthorized'},401);
 try{const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DOOR_BOOK_KEY).first<{body:string}>();return json({book:decodeDoorBook(row)});}
 catch{return json({error:'House history could not be verified. Refresh before visiting or changing a house.'},503);}
}
export async function POST(request:Request){
 if(!await authorized())return json({error:'Unauthorized'},401);
 let b:Record<string,unknown>;
 try{const v:unknown=await request.json();if(!v||typeof v!=='object'||Array.isArray(v))throw Error();b=v as Record<string,unknown>;}catch{return json({error:'Invalid house request.'},400);}
 if(!doorId(b.requestId)||!(b.expectedRevision===null||doorId(b.expectedRevision))||!['add','visit','unsuppress','locate','unpin'].includes(String(b.action)))return json({error:'Refresh and review the house request.'},400);
 const locationAction=b.action==='locate'||b.action==='unpin';
 const allowed=locationAction?['action','expectedRevision','houseId','requestId',...(b.action==='locate'?['point']:[])]:b.action==='add'?['action','address','expectedRevision','requestId','point']:b.action==='visit'?['action','expectedRevision','houseId','note','requestId','status','followUpOn']:['action','expectedRevision','houseId','note','requestId','status'];
 if(Object.keys(b).some(k=>!allowed.includes(k)))return json({error:'Unexpected house fields.'},400);
 if(b.action==='add'&&(typeof b.address!=='string'||!b.address.trim()||b.address.trim().length>240))return json({error:'Enter the full house address, city and unit if applicable.'},400);
 if((b.action==='add'||b.action==='locate')&&b.point!==undefined&&!validDoorPoint(b.point))return json({error:'Choose a valid map location.'},400);
 if(locationAction&&(!doorId(b.houseId)||b.action==='locate'&&!validDoorPoint(b.point)))return json({error:'Choose a saved house and location.'},400);
 if(b.action!=='add'&&!locationAction&&(!doorId(b.houseId)||!doorStatus(b.status)||typeof b.note!=='string'||b.note.length>1000))return json({error:'Choose a house, status and a note under 1,000 characters.'},400);
 if(b.action==='visit'&&(b.status==='follow-up'?!validDoorFollowUpDate(b.followUpOn):b.followUpOn!==undefined))return json({error:'Choose a valid revisit date for Follow-up. Other visit outcomes cannot carry a revisit date.'},400);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DOOR_BOOK_KEY).first<{body:string}>(),book=decodeDoorBook(row);
  const existingLocation=book.houses.find(h=>h.location?.requestId===b.requestId);
  if(locationAction&&existingLocation){const same=existingLocation.id===b.houseId&&JSON.stringify(existingLocation.location?.point)===JSON.stringify(b.action==='unpin'?null:b.point);return same?json({book,confirmed:true,requestId:b.requestId}):json({error:'Request ID already used for another location.'},409);}
  const existingHouse=book.houses.find(h=>h.id===b.requestId),existingEvent=book.houses.flatMap(h=>h.visits.map(e=>({houseId:h.id,event:e}))).find(x=>x.event.id===b.requestId);
  // Same operation can be safely acknowledged after a lost HTTP response.
  if(existingHouse||existingEvent){
   const matches=b.action==='add'?existingHouse?.address===(b.address as string).trim()&&JSON.stringify(existingHouse?.location?.point)===JSON.stringify(b.point):existingEvent?.houseId===b.houseId&&existingEvent?.event.status===b.status&&existingEvent?.event.note===b.note&&(existingEvent?.event.followUpOn??null)===(b.action==='visit'&&b.status==='follow-up'?b.followUpOn:null);
   return matches?json({book,confirmed:true,requestId:b.requestId}):json({error:'Request ID already used for different house details.'},409);
  }
  if(book.revision!==b.expectedRevision)return json({error:'House history changed on another device. Refresh and review it before saving.'},409);
  const now=new Date().toISOString();
  if(b.action==='add'){
   const address=(b.address as string).trim(),key=houseKey(address);
   if(book.houses.some(h=>h.addressKey===key))return json({error:'This house is already tracked. Search its address and review its last visit.'},409);
   book.houses.push({id:b.requestId,address,addressKey:key,createdAt:now,visits:[],...(b.point?{location:{point:b.point as {lat:number;lng:number},requestId:b.requestId as string,at:now}}:{})});
  }else if(locationAction){
   const house=book.houses.find(h=>h.id===b.houseId);if(!house)return json({error:'House not found. Refresh.'},404);
   house.location={point:b.action==='unpin'?null:b.point as {lat:number;lng:number},requestId:b.requestId as string,at:now};
  }else{
   const house=book.houses.find(h=>h.id===b.houseId);if(!house)return json({error:'House not found. Refresh.'},404);
   if(b.action==='unsuppress'){
    if(!doorSuppressed(house)||b.status!=='not-contacted')return json({error:'Review the suppressed house before allowing contact again.'},409);
   }else if(doorSuppressed(house))return json({error:'This house is marked Do not knock or Not interested. Contact remains blocked.'},409);
   // No-op dropdown changes never create accidental repeat visits.
   if(b.action==='visit'&&latestDoorVisit(house)?.status===b.status&&latestDoorVisit(house)?.note===b.note&&(latestDoorVisit(house)?.followUpOn??null)===(b.status==='follow-up'?b.followUpOn:null))return json({error:'That visit is already recorded. Review history before recording another.'},409);
   house.visits.push({id:b.requestId,status:b.status as keyof typeof import('../../../lib/door-knocking').DOOR_STATUSES,at:now,note:b.note as string,...(b.action==='visit'&&b.status==='follow-up'?{followUpOn:b.followUpOn as string}:{})});
  }
  book.revision=crypto.randomUUID();if(!validDoorBook(book))return json({error:'House history limit reached. Export history before expanding this tracker.'},400);
  const encoded=JSON.stringify(book);
  if(new TextEncoder().encode(encoded).length>1500000)return json({error:"House history is full. Export it before adding more."},400);
  const result=row?await env.DB.prepare('UPDATE message_templates SET body=?,updated_at=? WHERE key=? AND body=?').bind(encoded,now,DOOR_BOOK_KEY,row.body).run():await env.DB.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,?) ON CONFLICT(key) DO NOTHING").bind(DOOR_BOOK_KEY,encoded,now).run();
  if(result.meta.changes!==1)return json({error:'Another device saved first. Refresh house history.'},409);
  return json({book,confirmed:true,requestId:b.requestId});
 }catch{return json({error:'Save was not confirmed. Refresh house history before another attempt.'},503);}
}
