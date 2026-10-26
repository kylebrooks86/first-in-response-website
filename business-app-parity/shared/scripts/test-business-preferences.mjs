/** Actual owner settings, scheduling and follow-up routes on disposable SQLite. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),api=r.load('app/api/business-preferences/route.ts'),model=r.load('lib/business-preferences.ts');let count=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;};
const request=p=>api.PUT(new Request('https://synthetic.invalid/api/business-preferences',{method:'PUT',body:JSON.stringify(p)}));
try{
 let response=await api.GET();eq(response.status,200);let prefs=(await response.json()).preferences;eq(prefs,{revision:null,blocks:[],repeatMonths:{}});
 const block={id:crypto.randomUUID(),date:'2026-11-02',start:'00:00',end:'24:00',label:'Fire shift'};
 response=await request({...prefs,blocks:[block],repeatMonths:{'roof-wash':18,windows:4}});eq(response.status,200);prefs=(await response.json()).preferences;
 const writes=r.counters().writes;eq((await request({...prefs,revision:null})).status,200,'Exact absolute retry needs no second write');eq(r.counters().writes,writes);
 eq(model.scheduleBlockAt(prefs,'2026-11-02T17:00:00Z').id,block.id,'Tulsa standard-time date');eq(model.scheduleBlockAt(prefs,'2026-11-03T06:00:00Z'),null,'Next local day not blocked');
 eq(model.repeatIntervalFor(['House Wash','Soft-Wash Roof Cleaning'],{}),12,'Mixed job uses earliest service interval');eq(model.repeatIntervalFor(['Soft-Wash Roof Cleaning'],prefs.repeatMonths),18);eq(model.repeatIntervalFor(['House Wash'],{'house-wash':0}),null,'Off means no automatic rebook suggestion');
 for(const bad of [{...prefs,blocks:[{...block,date:'2026-02-30'}]},{...prefs,blocks:[{...block,start:'18:00',end:'09:00'}]},{...prefs,repeatMonths:{windows:-1}},{...prefs,repeatMonths:{windows:1.5}},{...prefs,unknown:1}])eq((await request(bad)).status,400);
 eq((await request({...prefs,revision:null,blocks:[]})).status,409,'Stale cross-device overwrite denied');
 r.db.prepare("INSERT INTO customers(id,name,created_at) VALUES ('availability-c','Synthetic availability','now')").run();r.db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES ('availability-e','availability-c','approved',20000,20000,10000,'signed','signed','now')").run();
 const signed=JSON.stringify(r.db.prepare("SELECT * FROM estimates WHERE id='availability-e'").get());
 response=await r.patch('availability-e',{scheduledAt:'2026-11-02T17:00:00Z'});eq(response.status,409);eq((await response.json()).error.includes('Fire shift'),true);eq(JSON.stringify(r.db.prepare("SELECT * FROM estimates WHERE id='availability-e'").get()),signed,'Blocked schedule never changes agreement or job');
 response=await r.patch('availability-e',{scheduledAt:'2026-11-03T17:00:00Z'});eq(response.status,200,'Unblocked date retains normal scheduling workflow');
 const followups=r.load('app/api/followups/route.ts');response=await followups.GET(new Request('https://synthetic.invalid/api/followups'));eq(response.status,200);
 r.setOwner(null);eq((await api.GET()).status,401);eq((await request(prefs)).status,401);r.setOwner({email:'other@example.invalid'});eq((await api.GET()).status,401);
 console.log('PASS '+count+' owner availability/cadence settings, exact retry, stale save, real scheduling and follow-up checks.');
}finally{r.db.close();}
