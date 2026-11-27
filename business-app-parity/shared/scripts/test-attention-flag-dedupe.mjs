/** Event-identity dedupe: actual helper, synthetic tasks, no saved-record mutations. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const s=readFileSync('lib/attention-flag-dedupe.ts','utf8');
const js=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={exports:{},Date,Set};vm.runInNewContext(js,ctx);
const f=ctx.exports.flagHasMatchingDueTask;assert.equal(typeof f,'function');
let n=0;function check(value,expected,reason){assert.equal(value,expected,reason);n++;}
const t='2026-10-21T12:00:00Z',other='2026-10-20T12:00:00Z';
const row=(id='t1',notes='FIRE yard sign placement: '+t,extra={})=>({id,customerId:'a',status:'open',notes,...extra});
check(f([row()],new Set(['t1']),'a','sign',t),true,'Open due exact sign task suppresses duplicate sign bell item');
check(f([row()],new Set([]),'a','sign',t),false,'Future/non-due task does not suppress due sign flag');
check(f([row('t1',undefined,{status:'completed'})],new Set(['t1']),'a','sign',t),false,'Completed task never auto-closes physical sign flag');
check(f([row('t1',undefined,{customerId:'b'})],new Set(['t1']),'a','sign',t),false,'Another customer is not cross-matched');
check(f([row()],new Set(['t1']),'a','sign',other),false,'Older sign placement is not falsely matched');
check(f([row()],new Set(['t1']),'a','review',t),false,'Sign marker does not match a review event');
check(f([row('t2','FIRE review request: '+t)],new Set(['t2']),'a','review',t),true,'Exact due review-check task suppresses duplicate');
check(f([row('t2','FIRE review request: '+other)],new Set(['t2']),'a','review',t),false,'Old review request does not hide a new one');
check(f([row('t3','Unrelated note')],new Set(['t3']),'a','sign',t),false,'Unrelated task cannot hide a sign flag');
check(f([row()],new Set(['t1']),'','sign',t),false,'Missing customer identity fails open');
check(f([row()],new Set(['t1']),'a','sign','bad date'),false,'Malformed event date never suppresses saved warning');
check(f([row()],new Set(['t1']),'a','sign',t),true,'Verification does not mutate task rows');
console.log('PASS '+n+'/'+n+' customer task-flag dedupe and identity checks (synthetic, read-only).');
