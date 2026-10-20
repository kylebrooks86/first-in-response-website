/** Real NWS hourly normalizer, trusted source, and owner-only API using synthetic data only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const importTs=async(path,prefix='')=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(prefix+readFileSync(path,'utf8').replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const weather=await importTs('lib/tulsa-weather.ts');
const now=Date.parse('2026-10-20T12:00:00-05:00');
const day='2026-10-20';
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
check(weather.isValidHourlyForecastDate(day,now),'Current Tulsa workday permitted');
for(const date of ['2026-10-19','2026-11-01','2026-02-30','2026-2-3','not-a-date','']){
 check(!weather.isValidHourlyForecastDate(date,now),'Invalid or out-of-window calendar date blocked: '+date);
}
check(weather.isValidHourlyForecastDate('2026-10-27',now),'Late NWS seven-day boundary can be requested');
const period=(start,options={})=>({
 startTime:start,endTime:new Date(Date.parse(start)+3600000).toISOString(),
 temperature:61,temperatureUnit:'F',shortForecast:'Mostly Cloudy',windSpeed:'5 to 11 mph',
 probabilityOfPrecipitation:{value:35},...options});
const periods=[
 period('2026-10-20T14:00:00-05:00',{temperature:63,shortForecast:'Rain Showers',probabilityOfPrecipitation:{value:70}}),
 period('2026-10-20T13:00:00-05:00',{probabilityOfPrecipitation:{value:null},windSpeed:'Calm'}),
 period('2026-10-20T15:00:00-05:00',{temperature:62}),
 period('2026-10-21T00:00:00-05:00'),
 period('2026-10-20T14:00:00-05:00',{temperature:7}), // repeated NWS hour
 period('2026-10-20T10:00:00-05:00'), // expired hour
 period('2026-10-20T16:00:00-05:00',{temperature:NaN}),
 period('2026-10-20T17:00:00-05:00',{temperatureUnit:'C'}),
];
const hourly=weather.normalizeHourlyForecast(periods,day,now);
check(hourly.date===day&&hourly.hours.length===3,'Only three valid future Tulsa hours are returned');
check(hourly.hours[0].startTime==='2026-10-20T13:00:00-05:00','Unsorted source periods ordered by real time');
check(hourly.hours[0].rainChance===null&&hourly.hours[0].windMph===null,'Missing rain and wind never invented as 0');
check(hourly.hours[1].rainChance===70&&hourly.hours[1].windMph===11,'Hourly rain and wind preserve valid NWS data');
check(hourly.hours[1].description==='Rain Showers','Conditions preserve official NWS text');
check(hourly.hours[2].temperature===62,'Temperature remains Fahrenheit and exact source hour');
let fetches=0;const hourlyUri='https://api.weather.gov/gridpoints/TSA/41,105/forecast/hourly';
const fake=async(url,options)=>{
 fetches++;check(new URL(url).origin==='https://api.weather.gov','All NWS upstream requests must be same-origin');
 check(options.redirect==='manual','Never follow unsafe redirects automatically');
 if(fetches===1)return Response.json({properties:{forecastHourly:hourlyUri}});
 return Response.json({properties:{periods}});
};
const fetched=await weather.loadTulsaHourlyForecast(day,fake,now);
check(fetches===2&&fetched.hours.length===3,'On-demand hourly NWS uses linked forecastHourly endpoint');
let offsite=0;
await assert.rejects(()=>weather.loadTulsaHourlyForecast(day,async()=>{
 offsite++;return offsite===1?Response.json({properties:{forecastHourly:'https://evil.invalid/forecast'}}):Response.json({properties:{periods}});
},now),/Invalid forecast source/);checks++;check(offsite===1,'Offsite hourly URL rejected without fetching');
await assert.rejects(()=>weather.loadTulsaHourlyForecast('2026-02-30',async()=>{throw Error('No request allowed');},now),/Invalid hourly forecast date/);checks++;
let authorized=false,loadCalls=0;
globalThis.__weatherHourlyOwner=()=>authorized?{email:'kylebrooks8605@gmail.com'}:null;
globalThis.__weatherHourlyLoad=async date=>{loadCalls++;return{date,location:'Tulsa',updatedAt:'2026-10-20T17:00:00Z',hours:[hourly.hours[0]]};};
const route=await importTs('app/api/weather/hourly/route.ts',
 'const getChatGPTUser=async()=>globalThis.__weatherHourlyOwner();\n'+
 'const isValidHourlyForecastDate=(date)=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)&&date==="2026-10-20";\n'+
 'const loadTulsaHourlyForecast=(date)=>globalThis.__weatherHourlyLoad(date);\n');
const url='https://synthetic.invalid/api/weather/hourly?date=2026-10-20';
check((await route.GET(new Request(url))).status===401,'Unauthenticated hourly forecast refused');
authorized=true;let response=await route.GET(new Request('https://synthetic.invalid/api/weather/hourly?date=invalid'));
check(response.status===400&&loadCalls===0,'Invalid calendar date refused before any remote work');
response=await route.GET(new Request(url));
check(response.status===200&&(await response.json()).hours.length===1,'Owner-only hourly forecast responds for one day');
check(response.headers.get('cache-control')==='private, max-age=300','Only authenticated hourly data may be privately cached briefly');
globalThis.__weatherHourlyLoad=async()=>{throw Error('Synthetic NWS outage');};
response=await route.GET(new Request(url));
check(response.status===503&&response.headers.get('cache-control').includes('no-store'),'Hourly outage fails independently without exposing stale weather');
console.log('PASS '+checks+' hourly NWS, exact Tulsa dates, day boundaries, missing metrics, SSRF prevention, auth, safe outage.');
