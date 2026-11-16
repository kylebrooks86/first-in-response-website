/**
 * FIRE owner-only estimate/invoice CREATE request safety.
 *
 * The route authenticates the owner FIRST. Then this helper imposes a
 * hard byte budget before JSON parsing, so a malformed large request can
 * never be buffered unboundedly. It makes NO D1/network/provider calls.
 *
 * Existing owner API clients may omit Content-Type; unlike public bearer
 * agreement writes this guard intentionally does not change that contract.
 */
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
