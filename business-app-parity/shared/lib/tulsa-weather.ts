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
export async function loadTulsaWeather(fetcher:typeof fetch=fetch):Promise<WeatherResponse>{
 const read=async(url:string)=>{const u=new URL(url);if(u.origin!=="https://api.weather.gov"||u.username||u.password)throw Error("Invalid forecast source");const response=await fetcher(u,{headers:{Accept:"application/geo+json","User-Agent":"FIRE-Business-App (https://firstinresponseexteriors.com)"},signal:AbortSignal.timeout(10000),redirect:"error"});if(!response.ok)throw Error("Weather unavailable");return await response.json() as {properties?:{forecast?:string;periods?:Period[]}};};
 const point=await read("https://api.weather.gov/points/36.15398,-95.99277");if(typeof point.properties?.forecast!=="string")throw Error("Missing forecast URL");
 const forecast=await read(point.properties.forecast);if(!Array.isArray(forecast.properties?.periods))throw Error("Missing forecast periods");
 return normalizeForecast(forecast.properties.periods);
}
