/** Read-only owner review of nearby scheduled START times (not an overlap detector).
 * Job durations, crew count and travel time are not stored, so a short gap is
 * merely a prompt to review actual commitments before promising another slot.
 * Group equal starts separately: the Schedule screen already handles those.
 */
export type TurnaroundJob={id:string;status:string;scheduledAt?:string|null};
export type TurnaroundWindow={firstAt:string;nextAt:string;gapMinutes:number;firstIds:string[];nextIds:string[]};
const tulsaDay=(ms:number)=>new Date(ms).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});

export function tightScheduleTurnarounds(jobs:readonly TurnaroundJob[],now:number,windowMinutes=120):TurnaroundWindow[]{
 if(!Number.isFinite(now)||!Number.isSafeInteger(windowMinutes)||windowMinutes<1||windowMinutes>240)return [];
 const starts=new Map<number,Set<string>>();
 for(const job of jobs){
  if(!job||job.status!=="scheduled"||typeof job.id!=="string"||!job.id||
     typeof job.scheduledAt!=="string"||!job.scheduledAt)continue;
  const parsed=Date.parse(job.scheduledAt);
  if(!Number.isFinite(parsed)||parsed<now)continue;
  // Source records use ISO timestamps. Only full start-minute precision is
  // meaningful for manual appointment reviews; a duplicate ID is never counted twice.
  const minute=Math.floor(parsed/60000)*60000;
  const ids=starts.get(minute)??new Set<string>();
  ids.add(job.id);starts.set(minute,ids);
 }
 const sorted=[...starts].sort(([a],[b])=>a-b);
 const result:TurnaroundWindow[]=[];
 for(let i=1;i<sorted.length;i++){
  const [firstAt,firstIds]=sorted[i-1], [nextAt,nextIds]=sorted[i];
  const gapMinutes=(nextAt-firstAt)/60000;
  if(gapMinutes<1||gapMinutes>windowMinutes||tulsaDay(firstAt)!==tulsaDay(nextAt))continue;
  result.push({firstAt:new Date(firstAt).toISOString(),nextAt:new Date(nextAt).toISOString(),
   gapMinutes,firstIds:[...firstIds].sort(),nextIds:[...nextIds].sort()});
 }
 return result;
}
