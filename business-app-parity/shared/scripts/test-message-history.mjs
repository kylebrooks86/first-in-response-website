import assert from 'node:assert/strict';
import {messageHistoryEntries} from '../lib/message-history.ts';
const prepared={id:'prepare-1',customerId:'customer-1',estimateId:'estimate-1',channel:'text_prepared',template:'estimate',body:'Same text',createdAt:'2026-10-14T10:00:00Z'};
const confirmed={...prepared,id:'prepare-1:owner-confirmed',channel:'text_confirmed',createdAt:'2026-10-14T11:00:00Z'};
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS: '+name);}
check('exact backend linkage groups two immutable events',()=>{const input=[confirmed,prepared],copy=structuredClone(input);assert.deepEqual(messageHistoryEntries(input),[{message:confirmed,prepared}]);assert.deepEqual(input,copy);});
for(const field of ['customerId','estimateId','channel','template','body'])check('mismatched '+field+' remains separate',()=>assert.equal(messageHistoryEntries([confirmed,{...prepared,[field]:'different'}]).length,2));
check('identical bodies with distinct operations remain separate',()=>assert.equal(messageHistoryEntries([confirmed,prepared,{...prepared,id:'prepare-2'}]).length,2));
check('confirmation without loaded preparation stays visible',()=>assert.deepEqual(messageHistoryEntries([confirmed]),[{message:confirmed}]));
check('legacy interactions are not inferred sent',()=>assert.equal(messageHistoryEntries([{...prepared,channel:'text'},confirmed]).length,2));
check('email uses exact same audit linkage',()=>assert.equal(messageHistoryEntries([{...prepared,channel:'email_prepared'},{...confirmed,channel:'email_confirmed'}]).length,1));
check('cancelled unsent draft groups with original immutable message',()=>{
 const cancelled={...prepared,id:'prepare-1:owner-cancelled',channel:'send_cancelled',body:'Owner confirmed this prepared message was not sent.',createdAt:'2026-10-14T12:00:00Z'};
 assert.deepEqual(messageHistoryEntries([cancelled,prepared]),[{message:cancelled,prepared}]);
 assert.equal(messageHistoryEntries([cancelled,{...prepared,customerId:'another-customer'}]).length,2);
 assert.equal(messageHistoryEntries([cancelled,{...prepared,estimateId:'another-job'}]).length,2);
});
console.log(`PASS ${passed}/${passed} message audit presentation checks`);
