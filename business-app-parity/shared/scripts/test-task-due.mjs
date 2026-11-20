/** Exact owner-local deadline buckets, no DB, hosting, timers, or customer records. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync('lib/task-due.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const context={exports:{},Date,Number};vm.runInNewContext(compiled,context);
const {taskDueBucket}=context.exports;
let checks=0;const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
const now=new Date(2026,9,20,12,30);
const open=dueAt=>({status:'open',dueAt});
const completed=dueAt=>({status:'completed',dueAt});
const local=(day,hour=12,minute=0)=>new Date(2026,9,day,hour,minute).toISOString();
eq(taskDueBucket(open(local(19,23)),now),'overdue','Previous day is overdue');
eq(taskDueBucket(open(local(20,9)),now),'overdue','Past hour today is overdue');
eq(taskDueBucket(open(local(20,12,30)),now),'today','Exactly now is due today');
eq(taskDueBucket(open(local(20,23,59)),now),'today','Remaining time today is due today');
eq(taskDueBucket(open(local(21,0,0)),now),'later','Tomorrow midnight is not today');
eq(taskDueBucket(open(local(29)),now),'later','Later month is upcoming');
eq(taskDueBucket(completed(local(19)),now),'none','Completed overdue task not counted');
eq(taskDueBucket(completed(local(20,14)),now),'none','Completed today task not counted');
eq(taskDueBucket(open(null),now),'none','Null due date is unclassified');
eq(taskDueBucket(open(''),now),'none','Blank due date is unclassified');
eq(taskDueBucket(open('not-a-date'),now),'none','Malformed due date is unclassified');
eq(taskDueBucket(open(local(20)),new Date(NaN)),'none','Invalid clock cannot classify');
const spring=new Date(2026,2,8,1,30);
eq(taskDueBucket(open(new Date(2026,2,8,3,30).toISOString()),spring),'today','Spring DST boundary uses next local midnight');
eq(taskDueBucket(open(new Date(2026,2,9,0,0).toISOString()),spring),'later','Spring DST next day is later');
const fall=new Date(2026,10,1,1,30);
eq(taskDueBucket(open(new Date(2026,10,1,23,0).toISOString()),fall),'today','Fall DST 25-hour day stays local today');
eq(taskDueBucket(open(new Date(2026,10,2,0,0).toISOString()),fall),'later','Fall DST next day is later');
console.log('PASS '+checks+'/'+checks+': open task deadlines are bucketed in owner-local calendar including DST. Pure synthetic cases.');
