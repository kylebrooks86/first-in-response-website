/** Retired availability blocks must never restrict scheduling; repeat settings stay intact. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),api=r.load('app/api/business-preferences/route.ts'),model=r.load('lib/business-preferences.ts');let count=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);count++;};
const request=p=>api.PUT(new Request('https://synthetic.invalid/api/business-preferences',{method:'PUT',body:JSON.stringify(p)}));
try{
 let response=await api.GET();eq(response.status,200);let prefs=(await response.json()).preferences;eq(prefs,{revision:null,blocks:[],repeatMonths:{}});
 const block={id:crypto.randomUUID(),date:'2026-11-02',start:'00:00',end:'24:00',label:'Unavailable'};
 // Old clients cannot create new availability entries.
 response=await request({...prefs,blocks:[block],repeatMonths:{'roof-wash':18}});eq(response.status,400,'Retired availability cannot be saved');
 eq(r.counters().writes,0,'Rejected retired block never writes');

 // Simulate a real older QA record in memory; runtime decoding must neutralize blocks
 // without deleting an unrelated repeat-service interval.
 const legacy={revision:null,blocks:[block],repeatMonths:{'roof-wash':18,windows:4}};
 r.db.prepare("INSERT INTO message_templates (key,subject,body,updated_at) VALUES (?,'',?,?)").run(model.BUSINESS_PREFERENCES_KEY,JSON.stringify(legacy),'2026-10-29T00:00:00.000Z');
 response=await api.GET();eq(response.status,200);prefs=(await response.json()).preferences;
 eq(prefs.blocks,[],'Hidden legacy blocked dates are not returned as active preferences');
 eq(prefs.repeatMonths,legacy.repeatMonths,'Unrelated repeat intervals remain');
 eq(model.decodeBusinessPreferences({body:JSON.stringify(legacy)}).blocks.length,0,'Decode always ignores legacy blocks');

 r.db.prepare("INSERT INTO customers(id,name,created_at) VALUES ('availability-c','Synthetic availability','now')").run();
 r.db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES ('availability-e','availability-c','approved',20000,20000,10000,'signed','signed','now')").run();
 response=await r.patch('availability-e',{scheduledAt:'2026-11-02T17:00:00Z'});
 eq(response.status,200,'Formerly blocked date is schedulable without removing approval/deposit guards');
 eq(r.db.prepare("SELECT status FROM estimates WHERE id='availability-e'").get().status,'scheduled','Scheduled state persisted');
 eq(model.repeatIntervalFor(['House Wash','Soft-Wash Roof Cleaning'],{}),12,'Mixed job uses earliest service interval');
 eq(model.repeatIntervalFor(['Soft-Wash Roof Cleaning'],prefs.repeatMonths),18);
 eq(model.repeatIntervalFor(['House Wash'],{'house-wash':0}),null,'Off still disables rebook suggestion');

 // A legitimate repeat-setting change replaces old serialized blocks with [].
 response=await request({...prefs,repeatMonths:{...prefs.repeatMonths,'roof-wash':24}});eq(response.status,200);
 prefs=(await response.json()).preferences;
 eq(prefs.blocks,[],'Updated settings cannot resurrect availability blocks');
 eq(prefs.repeatMonths['roof-wash'],24,'Repeat preference saved');
 eq(JSON.parse(r.db.prepare("SELECT body FROM message_templates WHERE key=?").get(model.BUSINESS_PREFERENCES_KEY).body).blocks,[],'Repeat PUT scrubs retired blocks in the edited row');
 const writes=r.counters().writes;
 eq((await request(prefs)).status,200,'Exact retry returns stored preferences');
 eq(r.counters().writes,writes,'Exact retry does not write');

 for(const bad of [{...prefs,blocks:[block]},{...prefs,repeatMonths:{windows:-1}},{...prefs,repeatMonths:{windows:1.5}},{...prefs,unknown:1}])eq((await request(bad)).status,400);
 eq((await request({...prefs,revision:null,repeatMonths:{'roof-wash':12}})).status,409,'Stale cross-device repeat overwrite denied');
 const followups=r.load('app/api/followups/route.ts');eq((await followups.GET(new Request('https://synthetic.invalid/api/followups'))).status,200);
 r.setOwner(null);eq((await api.GET()).status,401);eq((await request(prefs)).status,401);
 r.setOwner({email:'other@example.invalid'});eq((await api.GET()).status,401);
 console.log('PASS '+count+' retired availability, preserved repeat settings, booking and authorization checks.');
}finally{r.db.close();}
