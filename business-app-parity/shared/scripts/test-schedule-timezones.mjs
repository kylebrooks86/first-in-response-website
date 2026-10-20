/** Run the real schedule component regression in distinct device timezones. */
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
for(const zone of ['America/Chicago','UTC','Asia/Seoul']){
 const r=spawnSync(process.execPath,['scripts/test-schedule-load-errors.mjs'],{cwd:process.cwd(),env:{...process.env,TZ:zone},encoding:'utf8',timeout:20000});
 assert.equal(r.status,0,zone+': '+r.stdout+r.stderr);
 console.log('PASS: actual schedule routing, Central Time display and recovery in device timezone '+zone);
}
