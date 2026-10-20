/** Exact backdated expense calendar conversion. Synthetic inputs, no hosted data. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const javascript=ts.transpileModule(readFileSync('lib/expense-date.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const ctx={exports:{},Date,Number};vm.runInNewContext(javascript,ctx);
const {expenseDateInstant}=ctx.exports;
let checks=0;const eq=(got,want,label)=>{assert.equal(got,want,label);checks++;};
for(const [date,want] of [
 ['2026-10-16','2026-10-16T12:00:00.000Z'],
 ['2024-02-29','2024-02-29T12:00:00.000Z'],
 ['2026-12-31','2026-12-31T12:00:00.000Z'],
 ['2026-01-01','2026-01-01T12:00:00.000Z'],
 ['2026-02-29',null],
 ['2026-02-30',null],
 ['2026-04-31',null],
 ['2026-13-01',null],
 ['2026-00-01',null],
 ['2026-10-00',null],
 ['2026-10-32',null],
 ['2026-1-2',null],
 ['not-a-date',null],
 ['',null],
 ['2026-10-16T15:30:00Z',null],
 ['2026-10-16+2',null],
 ['2026-10-16 ',null],
 ['-2026-10-16',null]
])eq(expenseDateInstant(date),want,'ISO purchase date '+JSON.stringify(date));
const instant=expenseDateInstant('2026-10-16');
eq(instant?.slice(0,10),'2026-10-16','Wave CSV date remains selected calendar day');
eq(new Date(instant).toLocaleDateString('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}),'10/16/2026','US local customer record list shows same purchase date');
console.log('PASS '+checks+'/'+checks+': purchase-date exact calendar conversion and invalid date refusal.');
