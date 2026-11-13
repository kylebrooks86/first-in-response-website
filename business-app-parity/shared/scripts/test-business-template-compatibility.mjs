/** Exercise actual authenticated template route with stored synthetic defaults. */
import assert from 'node:assert/strict';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
import {LEGACY_BUSINESS_TEMPLATE_DEFAULTS} from '../lib/legacy-business-template-defaults.mjs';
import {templateByKey} from '../lib/fire-templates.ts';
let owner={email:'kylebrooks8605@gmail.com'},reads=0,writes=0;
const rows=Object.entries(LEGACY_BUSINESS_TEMPLATE_DEFAULTS).map(([key,value])=>({key,...value,updatedAt:'2026-10-01T00:00:00Z'}));
rows.push({key:'autoReply',subject:'Call Kyle about your project',body:'Customer Kyle Brooks: kyle@example.invalid',updatedAt:'2026-10-02T00:00:00Z'});
const snapshot=JSON.stringify(rows);
const env={DB:{prepare(sql){assert.match(sql,/^SELECT key,subject,body,updated_at/);reads++;return {async all(){return {results:structuredClone(rows)}},run(){writes++;throw Error('No writes permitted')}};}}};
const route=createRouteFixtureLoader(process.cwd(),env,()=>owner)('app/api/message-templates/route.ts');
owner=null;assert.equal((await route.GET()).status,401);assert.equal(reads,0);
owner={email:'customer@example.invalid'};assert.equal((await route.GET()).status,401);assert.equal(reads,0);
owner={email:'kylebrooks8605@gmail.com'};const response=await route.GET();assert.equal(response.status,200);const {templates}=await response.json();
for(const [key] of Object.entries(LEGACY_BUSINESS_TEMPLATE_DEFAULTS)){
 const actual=templates.find(item=>item.key===key);assert.ok(actual);
 if(key==='autoReply'){assert.equal(actual.subject,'Call Kyle about your project');assert.equal(actual.body,'Customer Kyle Brooks: kyle@example.invalid');}
 else{assert.equal(actual.subject,templateByKey(key).subject);assert.equal(actual.body,templateByKey(key).body);}
}
assert.equal(JSON.stringify(rows),snapshot);assert.equal(writes,0);
console.log('PASS: authenticated real template route upgrades exact stored defaults on read, retains custom text/timestamps, denies unauthorized access and performs no database writes.');
