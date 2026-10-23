import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {DOOR_BOOK_KEY,decodeDoorBook,doorRevisitQueue,doorTodayInTulsa} from '../../../../lib/door-knocking';
export const dynamic='force-dynamic';
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
export async function GET(){
 const user=await getChatGPTUser();
 if(!user||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return send({error:'Unauthorized'},401);
 try{
  const row=await env.DB.prepare('SELECT body FROM message_templates WHERE key=?').bind(DOOR_BOOK_KEY).first<{body:string}>();
  const today=doorTodayInTulsa();
  const revisits=doorRevisitQueue(decodeDoorBook(row),today);
  return send({today,dueCount:revisits.filter(item=>item.due).length,upcomingCount:revisits.filter(item=>!item.due).length,items:revisits.slice(0,5)});
 }catch{
  // Never invent an empty queue when stored history is unreadable/corrupt.
  return send({error:'Door revisit reminders could not be verified. Refresh saved house history before visiting.'},503);
 }
}
