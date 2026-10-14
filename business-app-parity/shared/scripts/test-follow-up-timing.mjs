import assert from 'node:assert/strict';
import {estimateFollowUpTiming} from '../lib/follow-up-timing.ts';
const now=Date.parse('2026-10-14T00:00:00Z'),day=86400000;
const ago=days=>new Date(now-days*day).toISOString();
const base={status:'sent',createdAt:ago(30)};
const cases=[
 ['delayed send starts today',{...base,lastEstimateSentAt:ago(0)},0,true],
 ['recent follow-up starts today',{...base,lastEstimateSentAt:ago(10),lastEstimateContactAt:ago(0)},0,true],
 ['one day boundary',{...base,lastEstimateSentAt:ago(1)},1,true],
 ['below one day',{...base,lastEstimateSentAt:ago(0.999)},0,true],
 ['three day boundary',{...base,lastEstimateSentAt:ago(3)},3,true],
 ['seven day boundary',{...base,lastEstimateSentAt:ago(7)},7,true],
 ['later resend supersedes earlier contact',{...base,lastEstimateSentAt:ago(1),lastEstimateContactAt:ago(4)},1,true],
 ['legacy sent keeps creation fallback',base,30,false],
 ['confirmed contact works without known original send',{...base,lastEstimateContactAt:ago(2)},2,true],
 ['draft stays creation based',{...base,status:'draft',lastEstimateSentAt:ago(0)},30,false],
 ['invalid confirmed timestamps fall back',{...base,lastEstimateSentAt:'invalid'},30,false],
 ['invalid creation does not invent overdue',{...base,createdAt:'invalid'},0,false],
 ['future confirmation is never overdue',{...base,lastEstimateSentAt:ago(-1)},0,true],
 ['invalid clock does not invent overdue',base,0,false,NaN],
];
for(const [name,estimate,ageDays,confirmedContact,clock=now] of cases)assert.deepEqual(estimateFollowUpTiming(estimate,clock),{ageDays,confirmedContact},name);
console.log(JSON.stringify({passed:cases.length,total:cases.length,checks:cases.map(c=>c[0])}));
