import { getChatGPTUser } from "../../chatgpt-auth";
import { loadTulsaWeather } from "../../../lib/tulsa-weather";
export async function GET(){
 const owner=await getChatGPTUser();if(owner?.email.toLowerCase()!=="kylebrooks8605@gmail.com")return Response.json({error:"Unauthorized"},{status:401});
 try{return Response.json(await loadTulsaWeather(),{headers:{"cache-control":"private, max-age=300"}});}catch{return Response.json({error:"Weather unavailable. Scheduling remains available."},{status:503,headers:{"cache-control":"no-store"}});}
}
