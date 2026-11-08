import {getChatGPTUser} from "../../../chatgpt-auth";
import {isValidHourlyForecastDate,loadTulsaHourlyForecast} from "../../../../lib/tulsa-weather";

/** Owner-only, on-demand NWS hourly forecast for one Tulsa calendar date.
 * No saved data, payments, or other hosted resources are touched. */
export async function GET(request:Request){
 const owner=await getChatGPTUser();
 if(owner?.email.toLowerCase()!=="kylebrooks8605@gmail.com")
  return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"private, no-store"}});
 const date=new URL(request.url).searchParams.get("date")??"";
 if(!isValidHourlyForecastDate(date))
  return Response.json({error:"Choose a forecast day within the next week."},{status:400,headers:{"cache-control":"private, no-store"}});
 try{
  const hourly=await loadTulsaHourlyForecast(date);
  return Response.json(hourly,{headers:{"cache-control":"private, max-age=300"}});
 }catch{
  return Response.json({error:"Hourly forecast is temporarily unavailable. Your seven-day forecast is still available."},{status:503,headers:{"cache-control":"private, no-store"}});
 }
}
