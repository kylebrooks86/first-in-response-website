import {getChatGPTUser} from "../../../chatgpt-auth";
import {isValidHourlyForecastDate,loadTulsaHourlyForecast} from "../../../../lib/tulsa-weather";
const PRIVATE_HEADERS = {"cache-control":"private, no-store","vary":"Cookie","x-content-type-options":"nosniff"};
const CACHED_HEADERS = {...PRIVATE_HEADERS,"cache-control":"private, max-age=300"};

/** Owner-only, on-demand NWS hourly forecast for one Tulsa calendar date.
 * No saved data, payments, or other hosted resources are touched. */
export async function GET(request:Request){
 const owner=await getChatGPTUser();
 if(owner?.email?.toLowerCase()!=="kylebrooks8605@gmail.com")
  return Response.json({error:"Unauthorized"},{status:401,headers:PRIVATE_HEADERS});
 const date=new URL(request.url).searchParams.get("date")??"";
 if(!isValidHourlyForecastDate(date))
  return Response.json({error:"Choose a forecast day within the next week."},{status:400,headers:PRIVATE_HEADERS});
 try{
  const hourly=await loadTulsaHourlyForecast(date);
  return Response.json(hourly,{headers:CACHED_HEADERS});
 }catch{
  return Response.json({error:"Hourly forecast is temporarily unavailable. Your seven-day forecast is still available."},{status:503,headers:PRIVATE_HEADERS});
 }
}
