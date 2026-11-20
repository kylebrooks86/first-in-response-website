/** Actual pure helper, source TypeScript transpiled and exercised without hosted resources. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('lib/schedule-turnarounds.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Date,Intl,Map,Set,Number,String};vm.runInNewContext(js,context);
const compute=(jobs,now,minutes)=>Array.from(context.exports.tightScheduleTurnarounds(jobs,now,minutes));
let checks=0;
function eq(a,b,message){assert.deepEqual(JSON.parse(JSON.stringify(a)),b,message);checks++;}
const future='2026-10-22T12:00:00.000Z',now=Date.parse(future),make=(id,t,status='scheduled')=>({id,scheduledAt:t,status});
const jobs=[
 make('earlier','2026-10-22T14:00:00.000Z'),
 make('same-a','2026-10-22T14:30:00.000Z'),
 make('same-b','2026-10-22T14:30:00.000Z'),
 make('later','2026-10-22T16:30:00.000Z'),
 make('far','2026-10-22T18:31:00.000Z'),
 make('ignored-complete','2026-10-22T15:00:00.000Z','completed'),
 make('ignored-draft','2026-10-22T15:30:00.000Z','draft'),
 make('past','2026-10-22T11:00:00.000Z'),
 make('bad','not-a-date'),
 make('duplicate','2026-10-22T14:30:00.000Z'),
 make('duplicate','2026-10-22T14:30:00.000Z')
];
const result=compute(jobs,now);
eq(result.map(r=>[r.gapMinutes,r.firstIds,r.nextIds]),[
 [30,['earlier'],['duplicate','same-a','same-b']],
 [120,['duplicate','same-a','same-b'],['later']]
],'Only consecutive distinct start-time groups inside 120 minutes trigger review; equal-minute jobs group once');
eq(compute(jobs,now,60).length,1,'Configurable sixty-minute owner advisory excludes two-hour gap');
eq(compute(jobs,now,0).length,0,'Invalid threshold refuses advisory rather than overclaiming');
eq(compute(jobs,NaN).length,0,'Unverifiable clock cannot claim a gap');
eq(compute(jobs,now,241).length,0,'Out-of-range threshold cannot produce unbounded alerts');
eq(compute([make('a',future),make('b',future)],now).length,0,'Exact same start minute belongs to existing Schedule conflict review, not turnaround');
eq(compute([make('a',future),make('b','2026-10-22T14:01:00.000Z')],now).length,0,'Gaps greater than two hours omitted');
eq(compute([make('a',future),make('b','2026-10-22T14:00:00.000Z')],now)[0].gapMinutes,120,'Exactly two hours is included');
eq(compute([make('a','2026-10-22T11:59:59.000Z'),make('b',future)],now).length,0,'Elapsed appointments ignored');
eq(compute([{id:'',scheduledAt:future,status:'scheduled'},make('ok','2026-10-22T12:30:00.000Z')],now).length,0,'Unknown IDs are not actionable');
eq(compute([null,{},make('valid',future)],now).length,0,'Malformed rows fail closed');
// Midnight in Tulsa, including the autumn daylight-saving transition.
// These are close in absolute time but occur on separate owner work dates.
for(const [before,after] of [
 ['2026-10-23T04:30:00.000Z','2026-10-23T05:30:00.000Z'],
 ['2026-11-01T04:30:00.000Z','2026-11-01T05:30:00.000Z'],
 ['2026-03-08T05:30:00.000Z','2026-03-08T06:30:00.000Z']
]){
 eq(compute([make('a',before),make('b',after)],Date.parse(before)-60_000).length,0,'Tulsa workday boundary suppresses false same-day adjacency '+before);
}
// Fall back repeats the 1 AM local hour. UTC difference, not wall-clock subtraction,
// is the safest available signal for a manual review.
eq(compute([make('first','2026-11-01T06:45:00.000Z'),make('second','2026-11-01T07:15:00.000Z')],Date.parse('2026-11-01T06:00:00.000Z'))[0].gapMinutes,30,'Fall DST repeats still use real elapsed minutes');
console.log('PASS '+checks+'/'+checks+' Tulsa tight-turnaround grouping, boundaries, duplicate starts, fail-closed input and DST in '+process.env.TZ);
