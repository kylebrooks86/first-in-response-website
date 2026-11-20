import { getChatGPTUser } from "../../chatgpt-auth";
import { loadTulsaWeather } from "../../../lib/tulsa-weather";
const PRIVATE_HEADERS = {"cache-control":"private, no-store","vary":"Cookie","x-content-type-options":"nosniff"};
const CACHED_HEADERS = {...PRIVATE_HEADERS,"cache-control":"private, max-age=300"};
export async function GET(){
 const owner=await getChatGPTUser();if(owner?.email?.toLowerCase()!=="kylebrooks8605@gmail.com")return Response.json({error:"Unauthorized"},{status:401,headers:PRIVATE_HEADERS});
 try{return Response.json(await loadTulsaWeather(),{headers:CACHED_HEADERS});}catch{return Response.json({error:"Weather unavailable. Scheduling remains available."},{status:503,headers:PRIVATE_HEADERS});}
}
