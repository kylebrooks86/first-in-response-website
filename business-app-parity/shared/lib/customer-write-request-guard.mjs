/**
 * Minimal, origin-bound JSON parser for unauthenticated customer-token writes.
 * This checks REQUEST SHAPE only: each route must still validate its share
 * token, authorization state, saved agreement and D1 business invariants.
 * Never widen Cloudflare Access or add payment/webhook endpoints here.
 */
const jsonReply=(error,status)=>Response.json(
  {error},{status,headers:{"Cache-Control":"no-store"}}
);
export async function readCustomerWriteJson(request,allowedFields,maxBytes=8192){
  // A cross-origin HTML form or malicious site must not submit customer
  // agreements using a browser that happens to know a share link.
  let origin;
  try{origin=new URL(request.url).origin;}
  catch{return {response:jsonReply("Invalid request origin.",403)};}
  if(request.headers.get("origin")!==origin)
    return {response:jsonReply("This customer action must originate on the estimate page.",403)};
  if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type")??""))
    return {response:jsonReply("JSON request required.",415)};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
    return {response:jsonReply("Customer request too large.",413)};
  if(!request.body)return {response:jsonReply("Invalid customer request.",400)};
  let raw="";
  let received=0;
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      received+=value.byteLength;
      if(received>maxBytes){
        await reader.cancel().catch(()=>{});
        return {response:jsonReply("Customer request too large.",413)};
      }
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
  }catch{return {response:jsonReply("Invalid customer request.",400)};}
  let body;
  try{body=JSON.parse(raw);}
  catch{return {response:jsonReply("Invalid customer request.",400)};}
  if(!body||typeof body!=="object"||Array.isArray(body)
    ||Object.keys(body).some(key=>!allowedFields.includes(key)))
    return {response:jsonReply("Invalid customer request.",400)};
  return {value:body};
}
