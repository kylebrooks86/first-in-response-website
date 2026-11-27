/** Guard tests only. Never imports/run a remote Cloudflare CLI or customer data. */
import assert from 'node:assert/strict';
import {
 requireD1Identity,requireCompletelyEmptyDR,rowsFromD1Json,readOnlyBoundSql
} from './owner_approved_dr_d1_migrate_20261113.mjs';
const uuid='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const live='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const list=[
 {name:'fire-fullapp-dr-db',uuid},
 {name:'fire-fullapp-new-live-db',uuid:live},
 {name:'fire-fullapp-qa-db-20261016',uuid:'8ccfb1f8-1657-4074-b1b2-47de78f95003'}
];
let checks=0;
const check=(yes,label)=>{assert.ok(yes,label);checks++;};
const blocks=(fn,label)=>{assert.throws(fn,/BLOCKED/,label);checks++;};
check(requireD1Identity(list).drUuid===uuid,'only existing DR physical UUID accepted');
for(const wrong of [
 [],[list[0]],[list[1]],list.map(x=>({...x,name:x.name==='fire-fullapp-dr-db'?'fire-fullapp-new-live-db':x.name})),
 list.map(x=>({...x,uuid:x.uuid===uuid?live:x.uuid})),
 [...list,{...list[0]}],
 [{name:'fire-fullapp-dr-db',uuid:live},list[1]]
])blocks(()=>requireD1Identity(wrong),'missing/duplicate/swapped D1 identity must block');
check(requireCompletelyEmptyDR([]).noApplicationTablesIndexesViewsOrTriggers,
 'empty physical sqlite_master is required before D1 apply');
for(const row of [
 {name:'customers',type:'table',sql:'CREATE TABLE customers(id TEXT)'},
 {name:'d1_migrations',type:'table',sql:'CREATE TABLE d1_migrations(id INTEGER)'},
 {name:'idx_test',type:'index',sql:'CREATE UNIQUE INDEX idx_test ON customers(id)'},
 {name:'evil',type:'trigger',sql:'CREATE TRIGGER evil AFTER INSERT ON customers BEGIN SELECT 1; END'},
 {name:'v_customers',type:'view',sql:'CREATE VIEW v_customers AS SELECT 1'},
 {name:'_cf_KV',type:'table',sql:'CREATE TABLE _cf_KV (unsafe TEXT)'},
 {name:'_cf_NEW',type:'table',sql:'CREATE TABLE _cf_NEW (key TEXT)'}
])blocks(()=>requireCompletelyEmptyDR([row]),'user/provider unknown physical schema must block');
const providerKV={name:'_cf_KV',type:'table',
 sql:'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID'};
const providerMeta={name:'_cf_METADATA',type:'table',
 sql:'CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB)'};
check(requireCompletelyEmptyDR([providerKV,providerMeta]).verifiedCloudflareMetadataOnly,
 'only reviewed exact provider metadata allowed');
blocks(()=>requireCompletelyEmptyDR([providerKV,providerKV]),
 'duplicate provider metadata blocks');
check(rowsFromD1Json([{success:true,results:[{n:1}]}])[0].n===1,
 'one successful Wrangler JSON SELECT accepted');
for(const fake of [[],[{}],[{success:false,results:[]}],[{success:true,results:null}],
 [{success:true,results:[]},{success:true,results:[]}],{}])
 blocks(()=>rowsFromD1Json(fake),'missing/failed/extra D1 statement response blocks');
check(readOnlyBoundSql('SELECT name FROM sqlite_master WHERE name=?',["O'Brien"])===
 "SELECT name FROM sqlite_master WHERE name='O''Brien'",'quoted bound read-only string');
check(readOnlyBoundSql('SELECT COUNT(*) AS n FROM "expenses"')===
 'SELECT COUNT(*) AS n FROM "expenses"','hard-coded read-only SQL allowed');
for(const bad of [
 ['UPDATE customers SET name=?',['x']],['PRAGMA table_info(customers)',[]],
 ['SELECT 1; DELETE FROM customers',[]],['SELECT ?',[]],['SELECT 1',['unused']]
])blocks(()=>readOnlyBoundSql(...bad),'only one safely-bound SELECT permitted');
console.log('PASS '+checks+'/'+checks+
 ' physical DR UUID / empty sqlite_master / D1 JSON / read-only SQL safety checks; no Wrangler/Cloudflare connections or writes.');
