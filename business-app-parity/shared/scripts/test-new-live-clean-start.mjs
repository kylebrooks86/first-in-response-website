import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertNewLiveFirstJobState,verifyNewLiveFirstJobState} from '../lib/new-live-clean-start.mjs';
const empty={customers:0,estimates:0,numberedCustomers:0,numberedJobs:0,jobLinks:0,customerSequence:0,jobSequence:0,invalidCustomers:0,invalidJobLinks:0};
assert.equal(assertNewLiveFirstJobState(empty),true);
assert.equal(assertNewLiveFirstJobState({...empty,customers:1,numberedCustomers:1,customerSequence:1}),true,
 'Saving a real customer before the first job must not block Job #0001');
assert.equal(assertNewLiveFirstJobState({...empty,customers:2,numberedCustomers:2,customerSequence:2,estimates:1,numberedJobs:1,jobLinks:1,jobSequence:1}),true);
for(const invalid of [
 {...empty,jobSequence:8},
 {...empty,numberedJobs:1,jobSequence:1},
 {...empty,jobLinks:1},
 {...empty,customers:1},
 {...empty,invalidCustomers:1},
 {...empty,invalidJobLinks:1},
 {...empty,numberedCustomers:1,customerSequence:1},
 {...empty,estimates:1},
 {...empty,estimates:2,numberedJobs:1,jobSequence:0},
 {...empty,customers:-1},
 {...empty,jobSequence:1.5},
 {...empty,jobSequence:'0'},
 null
])assert.throws(()=>assertNewLiveFirstJobState(invalid),/NEW LIVE/);
let sql='';
const db={prepare(query){sql=query;return {first:async()=>empty}}};
assert.equal(await verifyNewLiveFirstJobState(db),true);
assert.match(sql,/sqlite_sequence/);
assert.match(sql,/fire_job_estimate_links/);
assert.match(sql,/fire_customer_numbers/);
assert.match(sql,/e.customer_id<>root.customer_id/);
assert.match(sql,/LEFT JOIN fire_customer_numbers/);
const route=readFileSync(new URL('../app/api/estimates/route.ts',import.meta.url),'utf8');
assert.match(route,/FIRE_NEW_LIVE_CLEAN_START/);
assert.match(route,/await verifyNewLiveFirstJobState\(env.DB\)/);
assert.match(route,/!jobNumberFlag\|\|!customerNumberFlag/);
assert.ok(route.indexOf('await verifyNewLiveFirstJobState(env.DB)')<route.indexOf('const statements=[]'));
const customer=readFileSync(new URL('../app/api/customers/route.ts',import.meta.url),'utf8');
assert.match(customer,/recoveredAfterUncertainSave:true/);
assert.match(customer,/customerCreationReceipt\(env.DB,recoveryRequestId\)/);
assert.match(customer,/saveUncertain:true,requestId:recoveryRequestId/);
assert.match(customer,/FIRE_NEW_LIVE_CLEAN_START/);
assert.match(customer,/FIRE_CUSTOMER_NUMBERS_CANDIDATE/);
assert.match(customer,/if\(numbered&&!customerNumber\)/);
assert.match(customer,/if\(numbered&&!customerNumber\)throw Error/);
const communications=readFileSync(new URL('../app/api/customer-messages/route.ts',import.meta.url),'utf8');
assert.match(communications,/recoveredAfterUncertainPreparation:true/);
assert.match(communications,/recoveredAfterUncertainConfirmation:true/);
assert.match(communications,/deliveryConfirmed:false/);
assert.match(communications,/confirmationSource:'owner'/);
assert.match(communications,/saveUncertain:true/);
assert.match(communications,/op\.template!=='review'/);
assert.match(communications,/customer_messages WHERE id=\? AND customer_id=\? AND channel=\?/);
console.log('PASS: NEW LIVE numbering, customer save and communication uncertain-ACK recovery contracts');
