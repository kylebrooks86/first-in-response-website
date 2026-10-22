import assert from 'node:assert/strict';
import {
 isVerifiedTerritoryPin,filterTerritoryPins,isSafeCanvassTarget,
 candidateCanvassStops,offlineDoorKnockEvent,territorySummary
} from '../lib/territory-map-model.ts';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const point=(id,overrides={})=>({
 id,kind:'canvass',location:{latitude:36.15,longitude:-95.99,source:'owner-dropped',confirmedAt:'2026-10-22T11:00:00Z'},
 propertyId:id,customerId:null,serviceIds:['house-wash'],status:'not-visited',lastActivityOn:'2026-10-22',
 label:'Synthetic house '+id,note:'',doNotKnock:false,...overrides
});
const a=point('a'),b=point('b',{kind:'customer',customerId:'customer-1',status:null,serviceIds:['gutters'],label:'Existing customer'}),
 c=point('c',{status:'follow-up',serviceIds:['house-wash','gutters'],note:'Owner requested contact'}),
 d=point('d',{status:'do-not-knock',doNotKnock:true}),e=point('e',{status:'not-interested'}),
 f=point('f',{propertyId:'a',status:'no-answer'}),
 g=point('g',{kind:'yard-sign',status:null,serviceIds:['roof-cleaning']});
const all=[a,b,c,d,e,f,g];
for(const item of all)eq(isVerifiedTerritoryPin(item),true,'Verified synthetic coordinate accepted '+item.id);
for(const invalid of [
 point('x',{location:{...a.location,latitude:90.01}}),
 point('x',{location:{...a.location,longitude:181}}),
 point('x',{location:{...a.location,source:'unverified-address'}}),
 point('x',{location:null}),
 point('x',{lastActivityOn:'2026-02-30'}),
 point('x',{serviceIds:['gutters',0]}),
 point('x',{doNotKnock:'false'}),
 point('x',{status:'fake'}),
 ])eq(isVerifiedTerritoryPin(invalid),false,'Invalid coordinates or unverified fields never become pins');
eq(filterTerritoryPins([...all,point('unknown',{location:null})]).length,7,'Unverified legacy locations excluded from map');
eq(filterTerritoryPins(all,{serviceIds:['gutters']}).map(p=>p.id),['b','c'],'Service filtering finds matching history');
eq(filterTerritoryPins(all,{kinds:['customer']}).map(p=>p.id),['b'],'Customer layer exclusive');
eq(filterTerritoryPins(all,{kinds:['canvass'],statuses:['follow-up']}).map(p=>p.id),['c'],'Follow-up doors only');
eq(filterTerritoryPins(all,{sinceOn:'2026-10-23'}).length,0,'Activity date filtering');
eq(filterTerritoryPins(all,{text:'Existing customer'}).map(p=>p.id),['b'],'Owner searchable map pins');
eq(filterTerritoryPins(all,{bounds:{south:36,north:37,west:-96.5,east:-95.5}}).length,7,'Geographic bounds filter');
eq(filterTerritoryPins(all,{bounds:{south:39,north:40,west:-96.5,east:-95.5}}).length,0,'Other geography excluded');
for(const invalid of [{sinceOn:'2026-02-30'},{sinceOn:'2026-10-24',untilOn:'2026-10-22'},{bounds:{south:95,north:100,west:0,east:1}}])
 assert.throws(()=>filterTerritoryPins(all,invalid),'Reject bad date/bounds filters'),checks++;
eq(isSafeCanvassTarget(a),true,'Fresh canvass allowed');
for(const blocked of [b,d,e,g,point('h',{customerId:'known-customer'}),point('i',{status:'appointment'}),point('j',{status:'contacted'})])
 eq(isSafeCanvassTarget(blocked),false,'Never canvass known customers, DND, uninterested or completed contacts');
eq(candidateCanvassStops(all).map(p=>p.id),['a','c'],'Route candidates dedupe property and exclude DND');
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-123456789012',now='2026-10-22T12:00:00Z';
const offline=offlineDoorKnockEvent({eventId:uuid,pin:a,status:'no-answer',occurredAt:now,note:'No response'});
eq(offline.syncState,'local-pending','Offline knock is not falsely represented as synced');
eq(offline.mode,'owner-attested','Owner event not auto-geolocated');
eq(offline.pinId,'a','Event id binds to known point');
assert.throws(()=>offlineDoorKnockEvent({eventId:uuid,pin:d,status:'interested',occurredAt:now,note:''}),/Do-not-knock/);checks++;
eq(offlineDoorKnockEvent({eventId:uuid,pin:d,status:'do-not-knock',occurredAt:now,note:''}).status,'do-not-knock','Offline do-not-knock stays suppressed');
eq(territorySummary(all),{verifiedPins:7,customers:1,serviceProperties:6,knocked:4,followUps:1,suppressed:1},'Insights count only verified items, not guesses');
console.log('PASS '+checks+' FIRE territory filters, verified coordinate refusal, offline event provenance and do-not-knock protection.');
