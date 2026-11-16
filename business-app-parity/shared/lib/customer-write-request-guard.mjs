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

// Owner-only writes use the same hardened request-guard module without
// adding a new Cloudflare Worker server module. They intentionally omit the
// PUBLIC bearer-link Origin and Content-Type restrictions.
const refuse=(status,message)=>({
  value:undefined,
  response:Response.json({error:message},{status,headers:{'cache-control':'private, no-store'}})
});
export async function readOwnerWriteObject(request,maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144)
    return refuse(400,'Invalid owner request configuration.');
  const rawLength=request?.headers?.get('content-length');
  if(rawLength!==null&&rawLength!==undefined&&
    (!/^(0|[1-9][0-9]*)$/.test(rawLength)||
     !Number.isSafeInteger(Number(rawLength))))
    return refuse(400,'Invalid owner request length.');
  if(rawLength!==null&&rawLength!==undefined&&Number(rawLength)>maxBytes)
    return refuse(413,'Request exceeds the maximum allowed size.');
  if(!request?.body)return refuse(400,'A valid request object is required.');
  let reader;
  try{
    reader=request.body.getReader();
    const decoder=new TextDecoder('utf-8',{fatal:true});
    let raw='',received=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      // Native Response/Request streams in isolated VM test realms may carry
      // Uint8Array views whose instanceof checks are false across realms.
      if(!ArrayBuffer.isView(value)||
         Object.prototype.toString.call(value)!=='[object Uint8Array]')
        return refuse(400,'A valid request object is required.');
      received+=value.byteLength;
      if(received>maxBytes)return refuse(413,'Request exceeds the maximum allowed size.');
      raw+=decoder.decode(value,{stream:true});
    }
    if(received===0||(rawLength!==null&&rawLength!==undefined&&
       received!==Number(rawLength)))
      return refuse(400,'A valid request object is required.');
    raw+=decoder.decode();
    const value=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))
      return refuse(400,'A valid request object is required.');
    return {value,response:undefined};
  }catch{
    return refuse(400,'A valid request object is required.');
  }finally{
    if(reader){
      try{await reader.cancel();}catch{}
      try{reader.releaseLock();}catch{}
    }
  }
}
