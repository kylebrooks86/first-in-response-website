/**
 * Fail-closed, bounded, same-origin JSON parser for PUBLIC bearer-link writes.
 * This checks request shape only; routes MUST still validate token ownership,
 * accepted agreement/version and D1 business invariants.
 * Never widen Cloudflare Access or authorize Stripe/webhook actions here.
 */
const jsonReply=(error,status)=>Response.json(
 {error},{status,headers:{"Cache-Control":"no-store"}}
);
// Always expose both properties: TypeScript/Next must typecheck every
// public signature route without narrowing a mixed-shape JS return union.
const deny=(status,message)=>({response:jsonReply(message,status),value:undefined});
export async function readCustomerWriteJson(request,allowedFields,maxBytes=8192){
 if(!Array.isArray(allowedFields)||!allowedFields.every(x=>typeof x==='string')||
    !Number.isSafeInteger(maxBytes)||maxBytes<1)
  return deny(400,"Invalid customer request.");
 // A browser cannot submit customer approvals on another website via a
 // cross-origin form, and an absent/null Origin is never accepted.
 let origin;
 try{origin=new URL(request.url).origin;}
 catch{return deny(403,"Invalid request origin.");}
 if(request.headers.get("origin")!==origin)
  return deny(403,"This customer action must originate on the estimate page.");
 if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type")??""))
  return deny(415,"JSON request required.");
 const declared=request.headers.get("content-length");
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
    !Number.isSafeInteger(Number(declared))||Number(declared)>maxBytes))
  return deny(413,"Customer request too large.");
 if(!request.body)return deny(400,"Invalid customer request.");
 let reader;
 try{
  reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let raw="",received=0;
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   // Some Streams originate in another JS realm: instanceof Uint8Array
   // is not portable. Check the actual bytes-view brand before touching it.
   if(!ArrayBuffer.isView(value)||
      Object.prototype.toString.call(value)!=='[object Uint8Array]')
    return deny(400,"Invalid customer request.");
   received+=value.byteLength;
   if(received>maxBytes)return deny(413,"Customer request too large.");
   raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
  // Neither a short body nor extra bytes may silently contradict a declared
  // Content-Length; a valid empty stream is never a signed agreement.
  if(received===0||(declared!==null&&received!==Number(declared)))
   return deny(400,"Invalid customer request.");
  let body;
  try{body=JSON.parse(raw);}
  catch{return deny(400,"Invalid customer request.");}
  if(!body||typeof body!=="object"||Array.isArray(body)||
     Object.keys(body).some(key=>!allowedFields.includes(key)))
   return deny(400,"Invalid customer request.");
  return {response:undefined,value:body};
 }catch{
  return deny(400,"Invalid customer request.");
 }finally{
  if(reader){
   // A truncated/oversized request must not leave a dangling stream.
   try{await reader.cancel();}catch{}
   try{reader.releaseLock();}catch{}
  }
 }
}
