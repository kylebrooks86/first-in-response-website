export type WeatherDay = {date:string;temperatureMax:number|null;temperatureMin:number|null;rainChance:number|null;windMax:number|null};
export type WeatherResponse = {location:string;updatedAt:string;current:{temperature:number;description:string};daily:WeatherDay[]};
type Period = {startTime?:string;endTime?:string;isDaytime?:boolean;temperature?:number;temperatureUnit?:string;shortForecast?:string;windSpeed?:string;probabilityOfPrecipitation?:{value?:number|null}};

/** The NWS forecast is made from partial daytime/nighttime periods. A missing
 * high (after sunset) is unknown, not zero and not a forecast failure. */
export function formatDailyTemperatures(day:WeatherDay):string {
 const degrees=(value:number)=>`${Math.round(value)}°`;
 const high=day.temperatureMax;
 const low=day.temperatureMin;
 if(high!=null&&Number.isFinite(high)&&low!=null&&Number.isFinite(low))return `${degrees(high)} / ${degrees(low)}`;
 if(high!=null&&Number.isFinite(high))return `High ${degrees(high)}`;
 if(low!=null&&Number.isFinite(low))return `Low ${degrees(low)}`;
 return "Forecast pending";
}
export type WeatherIconKind="sun"|"sun-cloud"|"clear"|"moon-cloud"|"cloud"|"rain"|"snow"|"storm"|"fog"|"wind";
export function weatherIconKind(description:string):WeatherIconKind {
 const text=String(description||"").toLowerCase();
 if(/thunder|t-?storm|lightning/.test(text))return "storm";
 if(/snow|sleet|flurr|ice pellet|freezing rain|blizzard/.test(text))return "snow";
 if(/rain|shower|drizzle|precipitation/.test(text))return "rain";
 if(/fog|haze|smoke|mist/.test(text))return "fog";
 if(/mostly cloudy|overcast|cloudy/.test(text))return /partly cloudy/.test(text)?"moon-cloud":"cloud";
 if(/partly sunny|mostly sunny/.test(text))return "sun-cloud";
 if(/partly cloudy/.test(text))return "moon-cloud";
 if(/sunny|fair/.test(text))return "sun";
 if(/clear/.test(text))return "clear";
 if(/breezy|windy/.test(text))return "wind";
 return "cloud";
}
export function weatherDayHeading(day:WeatherDay,now=Date.now()):string {
 // Midnight rollover is based on Tulsa time, not the browser's device zone.
 if(day.date===dateKey(new Date(now).toISOString())&&day.temperatureMax==null&&day.temperatureMin!=null)return "Tonight";
 return new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US",{weekday:"short",timeZone:"America/Chicago"});
}

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
