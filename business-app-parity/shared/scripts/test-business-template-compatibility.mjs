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
owner=null;const anonymous=await route.GET();assert.equal(anonymous.status,401);assert.equal(reads,0);
assert.equal(anonymous.headers.get('cache-control'),'no-store, private');
assert.equal(anonymous.headers.get('vary'),'Cookie');
assert.equal(anonymous.headers.get('x-content-type-options'),'nosniff');
owner={email:'customer@example.invalid'};const nonowner=await route.GET();assert.equal(nonowner.status,401);assert.equal(reads,0);
assert.equal(nonowner.headers.get('cache-control'),'no-store, private');
owner={email:'kylebrooks8605@gmail.com'};const response=await route.GET();assert.equal(response.status,200);
assert.equal(response.headers.get('cache-control'),'no-store, private','Owner-specific saved template text is never cacheable');
assert.equal(response.headers.get('vary'),'Cookie','Caches must not reuse authenticated templates between sessions');
assert.equal(response.headers.get('x-content-type-options'),'nosniff','Template JSON cannot be interpreted as another content type');
const {templates}=await response.json();
for(const [key] of Object.entries(LEGACY_BUSINESS_TEMPLATE_DEFAULTS)){
 const actual=templates.find(item=>item.key===key);assert.ok(actual);
 if(key==='autoReply'){assert.equal(actual.subject,'Call Kyle about your project');assert.equal(actual.body,'Customer Kyle Brooks: kyle@example.invalid');}
 else{assert.equal(actual.subject,templateByKey(key).subject);assert.equal(actual.body,templateByKey(key).body);}
}
// The customer-facing agreement must never offer payment methods the owner
// expressly refuses; protect the NEW QA-master default and future template resets.
const customerTerms=templateByKey('contractTerms').body;
assert.match(customerTerms,/Checks are not accepted\./,'The actual customer contract explicitly rejects checks');
assert.doesNotMatch(customerTerms,/Accepted methods may include cash, check/i,'No legacy offer of checks in customer terms');
assert.doesNotMatch(customerTerms,/ACH bank transfer/i,'No unsupported ACH method offered in customer terms');
assert.match(customerTerms,/Venmo \(@FirstInResponseExteriors\)/,'Existing approved Venmo handle remains visible');
assert.match(customerTerms,/Cash App \(\$FIREExteriors\)/,'Existing approved Cash App handle remains visible');
assert.equal(JSON.stringify(rows),snapshot);assert.equal(writes,0);
console.log('PASS: authenticated real template route upgrades exact stored defaults on read, retains custom text/timestamps, denies unauthorized access and performs no database writes.');
