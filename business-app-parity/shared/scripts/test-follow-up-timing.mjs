import assert from 'node:assert/strict';
import {estimateFollowUpTiming,estimateReminderStage} from '../lib/follow-up-timing.ts';
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
const record=(days,patch={})=>({status:'sent',firstEstimateSentAt:ago(days),lastEstimateSentAt:ago(days),lastEstimateContactAt:ago(days),...patch});
const stages=[
 ['legacy requires review',record(8,{firstEstimateSentAt:null,lastEstimateSentAt:null}),null,true],
 ['fresh send',record(0),null,false],
 ['day one',record(1),'followUp1',false],
 ['day three',record(3),'followUp3',false],
 ['day seven',record(7),'followUp7',false],
 ['stage one not repeated',record(2,{stage1At:ago(1),lastEstimateContactAt:ago(1)}),null,false],
 ['stage three not repeated',record(5,{stage3At:ago(2),lastEstimateContactAt:ago(2)}),null,false],
 ['stage seven completes cycle',record(10,{stage7At:ago(3),lastEstimateContactAt:ago(3)}),null,false],
 ['contact cooldown',record(8,{stage1At:ago(.25),lastEstimateContactAt:ago(.25)}),null,false],
 ['future stage needs review',record(8,{stage7At:ago(-1)}),null,true],
 ['out of order needs review',record(10,{stage7At:ago(8),stage1At:ago(1)}),null,true],
 ['before initial send needs review',record(4,{stage7At:ago(12)}),null,true],
 ['new send cycle ignores prior stages',record(2,{firstEstimateSentAt:ago(20),stage7At:ago(10)}),'followUp1',false],
 ['draft is not a sent stage',record(8,{status:'draft'}),null,false],
 ['manual contact cooldown',record(8,{lastManualContactAt:ago(.5)}),null,false],
 ['manual contact boundary',record(8,{lastManualContactAt:ago(1)}),'followUp7',false],
 ['future manual contact needs review',record(8,{lastManualContactAt:ago(-1)}),null,true],
 ['invalid manual contact needs review',record(8,{lastManualContactAt:'invalid'}),null,true],
 ['snooze suppresses quote only',record(8,{snoozeUntil:ago(-7)}),null,false],
 ['expired snooze returns existing stage',record(8,{snoozeUntil:ago(0)}),'followUp7',false],
 ['invalid snooze requires review',record(8,{snoozeUntil:'invalid'}),null,true],
 ['invalid stage needs review' ,record(8,{stage3At:'invalid'}),null,true],
];
for(const [name,value,template,review] of stages){const result=estimateReminderStage(value,now);assert.equal(result.template,template,name);assert.equal(Boolean(result.reviewReason),review,name);}
console.log(JSON.stringify({passed:cases.length+stages.length,total:cases.length+stages.length,checks:[...cases.map(c=>c[0]),...stages.map(c=>c[0])]}));
