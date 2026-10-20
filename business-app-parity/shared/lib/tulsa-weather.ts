export type WeatherDay = {date:string;temperatureMax:number|null;temperatureMin:number|null;rainChance:number|null;windMax:number|null};
export type WeatherResponse = {location:string;updatedAt:string;current:{temperature:number;description:string};daily:WeatherDay[]};
export type WeatherHour = {startTime:string;temperature:number;description:string;rainChance:number|null;windMph:number|null};
export type HourlyForecastResponse = {date:string;location:string;updatedAt:string;hours:WeatherHour[]};

/** Daily NWS planning cues for Tulsa, not guarantees for the customer's property. */
export function dailyWorkCautions(day:WeatherDay):string[]{
 const cautions:string[]=[];
 if(day.rainChance!=null&&Number.isFinite(day.rainChance)&&day.rainChance>=50)cautions.push("Rain chance ≥50%");
 if(day.windMax!=null&&Number.isFinite(day.windMax)&&day.windMax>=20)cautions.push("Wind ≥20 mph");
 if(day.temperatureMin!=null&&Number.isFinite(day.temperatureMin)&&day.temperatureMin<=32)cautions.push("Freezing low ≤32°F");
 // NWS Fahrenheit air temperature is a planning cue, not surface heat or heat index.
 // High solar radiation, humidity and physical workload can raise heat risk below these values.
 if(day.temperatureMax!=null&&Number.isFinite(day.temperatureMax)){
  if(day.temperatureMax>=95)cautions.push("Very hot air ≥95°F — monitor surface drying and heat exposure");
  else if(day.temperatureMax>=85)cautions.push("Hot air ≥85°F — check solution drying and heat exposure");
 }
 return cautions;
}


/** Owner-facing planning cues, not a decision that outdoor work is safe.
 * Never treat absent NWS values as a benign 0% chance or calm conditions. */
export function hourlyWorkCautions(hour:WeatherHour):string[]{
 const cautions:string[]=[];
 if(hour.rainChance!=null&&Number.isFinite(hour.rainChance)&&hour.rainChance>=50)cautions.push("Rain chance ≥50%");
 if(hour.windMph!=null&&Number.isFinite(hour.windMph)&&hour.windMph>=20)cautions.push("Wind ≥20 mph");
 if(Number.isFinite(hour.temperature)&&hour.temperature<=32)cautions.push("Freezing ≤32°F");
 if(Number.isFinite(hour.temperature)){
  if(hour.temperature>=95)cautions.push("Very hot air ≥95°F — monitor surface drying and heat exposure");
  else if(hour.temperature>=85)cautions.push("Hot air ≥85°F — check solution drying and heat exposure");
 }
 return cautions;
}


/** Only dates from the seven-day NWS outlook are available for hourly drill-down.
 * Allow the next calendar week's boundary because late NWS forecast periods
 * can begin after midnight Tulsa time. */
export function isValidHourlyForecastDate(date:string,now=Date.now()):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const parsed=new Date(date+"T12:00:00.000Z");
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return false;
 const today=dateKey(new Date(now).toISOString());
 const difference=(Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000;
 return Number.isInteger(difference)&&difference>=0&&difference<=7;
}

/** Select actual hourly NWS periods for the requested Tulsa calendar day.
 * Missing rain and wind information stays unknown rather than becoming 0%. */
export function normalizeHourlyForecast(periods:Period[],date:string,now=Date.now()):HourlyForecastResponse{
 if(!isValidHourlyForecastDate(date,now))throw Error("Invalid hourly forecast date");
 if(!Array.isArray(periods))throw Error("Missing hourly forecast periods");
 const hours:WeatherHour[]=[];
 const seen=new Set<string>();
 for(const period of periods){
  if(!period||typeof period!=="object"||!period.startTime||!period.endTime)continue;
  const start=Date.parse(period.startTime),end=Date.parse(period.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=now||end<=start||dateKey(period.startTime)!==date||seen.has(period.startTime))continue;
  if(typeof period.temperature!=="number"||!Number.isFinite(period.temperature)||period.temperatureUnit!=="F")continue;
  seen.add(period.startTime);
  const rain=period.probabilityOfPrecipitation?.value;
  const rainChance=typeof rain==="number"&&Number.isFinite(rain)&&rain>=0&&rain<=100?rain:null;
  const wind=period.windSpeed?.includes("mph")?period.windSpeed.match(/\d+(?:\.\d+)?/g)?.map(Number):undefined;
  const windMph=wind?.length?Math.max(...wind):null;
  hours.push({startTime:period.startTime,temperature:period.temperature,
   description:period.shortForecast||"Conditions unavailable",rainChance,windMph});
 }
 hours.sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime));
 return {date,location:"Tulsa",updatedAt:new Date(now).toISOString(),hours:hours.slice(0,25)};
}

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
 return new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US",{weekday:"short",timeZone:"America/Chicago"});
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
/** Only allow NWS-hosted HTTPS links, including validated canonical redirects. */
async function readNwsWeather(address:string,fetcher:typeof fetch){
 const origin="https://api.weather.gov";
 const validate=(address:string)=>{const u=new URL(address);if(u.origin!==origin||u.username||u.password||u.port)throw Error("Invalid forecast source");return u;};
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
   return await response.json() as {properties?:{forecast?:string;forecastHourly?:string;periods?:Period[]}};
  }
  throw Error("Too many forecast redirects");
}
export async function loadTulsaWeather(fetcher:typeof fetch=fetch):Promise<WeatherResponse>{
 const point=await readNwsWeather("https://api.weather.gov/points/36.15398,-95.99277",fetcher);
 if(typeof point.properties?.forecast!=="string")throw Error("Missing forecast URL");
 const forecast=await readNwsWeather(point.properties.forecast,fetcher);
 if(!Array.isArray(forecast.properties?.periods))throw Error("Missing forecast periods");
 return normalizeForecast(forecast.properties.periods);
}
export async function loadTulsaHourlyForecast(date:string,fetcher:typeof fetch=fetch,now=Date.now()):Promise<HourlyForecastResponse>{
 if(!isValidHourlyForecastDate(date,now))throw Error("Invalid hourly forecast date");
 const point=await readNwsWeather("https://api.weather.gov/points/36.15398,-95.99277",fetcher);
 if(typeof point.properties?.forecastHourly!=="string")throw Error("Missing hourly forecast URL");
 const forecast=await readNwsWeather(point.properties.forecastHourly,fetcher);
 if(!Array.isArray(forecast.properties?.periods))throw Error("Missing hourly forecast periods");
 return normalizeHourlyForecast(forecast.properties.periods,date,now);
}
