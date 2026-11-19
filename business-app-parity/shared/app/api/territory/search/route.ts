import {getChatGPTUser} from '../../../chatgpt-auth';
import {validDoorPoint} from '../../../../lib/door-knocking';
import {readOwnerWriteObject} from '../../../../lib/customer-write-request-guard.mjs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
/** Explicit owner address lookup only. Never send names, notes or bulk records. */
export async function POST(request:Request){
 if((await getChatGPTUser())?.email.toLowerCase()!=='kylebrooks8605@gmail.com')return json({error:'Unauthorized'},401);
 // Bound actual UTF-8 bytes and reject cross-origin owner browser requests
 // before any Census network call. Existing server-side callers still require owner auth.
 const parsed=await readOwnerWriteObject(request,2048);
 if(parsed.response)return parsed.response;
 const body=parsed.value as Record<string,unknown>;
 if(Object.keys(body).length!==1||!Object.prototype.hasOwnProperty.call(body,'address'))return json({error:'Enter a street address.'},400);
 const address=body.address;
 if(typeof address!=='string'||address.trim().length<5||address.length>240)return json({error:'Enter a full street address, city and state.'},400);
 try{
  const url=new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');url.search=new URLSearchParams({address:address.trim(),benchmark:'Public_AR_Current',format:'json'}).toString();
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!r.ok)throw Error();
  const data=await r.json() as {result?:{addressMatches?:{matchedAddress:string;coordinates:{x:number;y:number}}[]}};
  const matches=(data.result?.addressMatches??[]).slice(0,5).map(m=>({address:m.matchedAddress,point:{lat:m.coordinates?.y,lng:m.coordinates?.x}})).filter(m=>typeof m.address==='string'&&validDoorPoint(m.point));
  return json({matches});
 }catch{return json({error:'Address lookup unavailable. Place the pin manually.'},503);}
}
