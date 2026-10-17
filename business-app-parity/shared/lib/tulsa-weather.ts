export type WeatherDay = {date:string;temperatureMax:number|null;temperatureMin:number|null;rainChance:number|null;windMax:number|null};
export type WeatherResponse = {location:string;updatedAt:string;current:{temperature:number;description:string};daily:WeatherDay[]};
type Period = {startTime?:string;endTime?:string;isDaytime?:boolean;temperature?:number;temperatureUnit?:string;shortForecast?:string;windSpeed?:string;probabilityOfPrecipitation?:{value?:number|null}};
const dateKey=(value:string)=>new Date(value).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
export function normalizeForecast(periods:Period[],now=Date.now()):WeatherResponse {
 const valid=periods.filter(p=>p&&typeof p==="object"&&p.startTime&&p.endTime&&Number.isFinite(Date.parse(p.startTime))&&Number.isFinite(Date.parse(p.endTime))&&Date.parse(p.endTime)>now&&typeof p.temperature==="number"&&Number.isFinite(p.temperature)&&p.temperatureUnit==="F");
 if(!valid.length)throw Error("No current forecast");
 const days=new Map<string,WeatherDay>();
 for(const p of valid){const date=dateKey(p.startTime!);const day=days.get(date)||{date,temperatureMax:null,temperatureMin:null,rainChance:null,windMax:null};
 const wind=p.windSpeed?.match(/\d+(?:\.\d+)?/g)?.map(Number);if(wind?.length&&p.windSpeed?.includes("mph"))day.windMax=Math.max(day.windMax??0,...wind);
 const rain=p.probabilityOfPrecipitation?.value;if(typeof rain==="number"&&Number.isFinite(rain)&&rain>=0&&rain<=100)day.rainChance=Math.max(day.rainChance??0,rain);
 if(p.isDaytime)day.temperatureMax=Math.max(day.temperatureMax??-Infinity,p.temperature!);else day.temperatureMin=Math.min(day.temperatureMin??Infinity,p.temperature!);
 days.set(date,day);}
 return {location:"Tulsa",updatedAt:new Date(now).toISOString(),current:{temperature:valid[0].temperature!,description:valid[0].shortForecast||"Forecast"},daily:[...days.values()].slice(0,7)};
}
/** NWS may canonicalize coordinates with a 301/302 redirect. Follow ONLY
 * same-origin HTTPS api.weather.gov locations, never arbitrary upstream URLs.
 * Cloudflare Workers' redirect:"error" used to reject valid NWS responses. */
export async function loadTulsaWeather(fetcher:typeof fetch=fetch):Promise<WeatherResponse>{
 const origin="https://api.weather.gov";
 const validate=(address:string)=>{const u=new URL(address);if(u.origin!==origin||u.username||u.password||u.port)throw Error("Invalid forecast source");return u;};
 const read=async(address:string)=>{
  let url=validate(address);
  const seen=new Set<string>();
  for(let attempt=0;attempt<3;attempt++){
   if(seen.has(url.href))throw Error("Repeated forecast redirect");
   seen.add(url.href);
   const response=await fetcher(url,{headers:{Accept:"application/geo+json","User-Agent":"FIRE-Business-App (https://firstinresponseexteriors.com)"},signal:AbortSignal.timeout(10000),redirect:"manual"});
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get("location");
    if(!location)throw Error("Missing forecast redirect location");
    url=validate(new URL(location,url).href);
    continue;
   }
   if(!response.ok)throw Error("Weather unavailable");
   return await response.json() as {properties?:{forecast?:string;periods?:Period[]}};
  }
  throw Error("Too many forecast redirects");
 };
 const point=await read("https://api.weather.gov/points/36.15398,-95.99277");if(typeof point.properties?.forecast!=="string")throw Error("Missing forecast URL");
 const forecast=await read(point.properties.forecast);if(!Array.isArray(forecast.properties?.periods))throw Error("Missing forecast periods");
 return normalizeForecast(forecast.properties.periods);
}
