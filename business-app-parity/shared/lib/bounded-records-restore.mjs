/**
 * FIRE owner backup restore: read a JSON request with a hard BEFORE-allocation
 * byte budget. A Content-Length is untrusted; count every streamed byte too.
 *
 * Former POST /api/backup awaited request.text() before comparing string length,
 * allowing an unbounded body to be buffered even though the 5 MB limit existed.
 * This function does not write databases, photos, payments or provider state.
 */
export const RECORDS_RESTORE_MAX_BYTES=5_000_000;
const stopped=(message,status)=>Response.json({error:message},{status,headers:{'cache-control':'no-store'}});
const tooLarge=()=>stopped('That backup is larger than the 5 MB restore limit.',413);
export async function readBoundedRecordsRestoreText(request){
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^\d{1,9}$/.test(declared)||Number(declared)>RECORDS_RESTORE_MAX_BYTES))
  return tooLarge();
 if(!request.body)return stopped('Backup upload was empty; no records changed.',400);
 let reader;
 try{
  reader=request.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let total=0,text='';
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))return stopped('Invalid backup upload; no records changed.',400);
   total+=value.byteLength;
   if(total>RECORDS_RESTORE_MAX_BYTES)return tooLarge();
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  if(!total)return stopped('Backup upload was empty; no records changed.',400);
  return text;
 }catch{
  return stopped('Backup upload was incomplete or invalid UTF-8; no records changed.',400);
 }finally{
  if(reader){try{await reader.cancel();}catch{}try{reader.releaseLock();}catch{}}
 }
}
