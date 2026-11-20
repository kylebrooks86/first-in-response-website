import assert from 'node:assert/strict';
import {serviceLocationManifest,serviceLocationBackupError} from '../lib/service-location-backup.mjs';
const row={estimate_id:'e',customer_id:'c',address:'',captured_at:'2026-10-14T00:00:00.000Z'};
const payload=()=>({includes:{serviceAddressSnapshots:true},serviceLocationSnapshots:serviceLocationManifest([row]),tables:{customers:[{id:'c'}],estimates:[{id:'e',customer_id:'c'}],estimate_service_locations:[{...row}]}});
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS: '+name);};
check('blank captured address is preserved',()=>{const p=payload();assert.equal(serviceLocationBackupError(p,p.tables),null);assert.equal(p.tables.estimate_service_locations[0].address,'');});
check('legacy format is accepted without inventing snapshots',()=>assert.equal(serviceLocationBackupError({},{}),null));
for(const [name,edit] of [
 ['missing declared table',p=>delete p.tables.estimate_service_locations],
 ['omitted row',p=>p.tables.estimate_service_locations=[]],
 ['duplicate identity',p=>p.tables.estimate_service_locations.push({...row})],
 ['wrong customer',p=>p.tables.estimate_service_locations[0].customer_id='other'],
 ['orphan estimate',p=>p.tables.estimates=[]],
 ['wrong address type',p=>p.tables.estimate_service_locations[0].address=null],
 ['invalid capture timestamp',p=>p.tables.estimate_service_locations[0].captured_at='invalid'],
 ['extra unknown field',p=>p.tables.estimate_service_locations[0].default_address='unsafe'],
 ['missing coverage manifest',p=>delete p.serviceLocationSnapshots],
 ['duplicate manifest identity',p=>p.serviceLocationSnapshots.estimateIds.push('e')],
 ['missing coverage declaration',p=>delete p.includes.serviceAddressSnapshots],
])check(name,()=>{const p=payload();edit(p);assert.ok(serviceLocationBackupError(p,p.tables));});
console.log(JSON.stringify({passed,total:passed}));
