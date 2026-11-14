/** Exact backdated expense calendar conversion. Synthetic inputs, no hosted data. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const javascript=ts.transpileModule(readFileSync('lib/expense-date.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const ctx={exports:{},Date,Number};vm.runInNewContext(javascript,ctx);
const {expenseDateInstant,expenseBusinessDay,expenseBusinessDateLabel}=ctx.exports;
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
// Tulsa owner date, not the UTC date or device timezone, controls tax-year
// inclusion and the exact date shown in Business and Wave CSV.
for(const [instant,day,label] of [
 ['2026-12-31T23:59:00.000Z','2026-12-31','December 31 during Tulsa evening'],
 ['2027-01-01T04:30:00.000Z','2026-12-31','December 31 10:30pm Tulsa is UTC January 1'],
 ['2027-01-01T05:59:59.000Z','2026-12-31','December 31 at 11:59:59pm Tulsa'],
 ['2027-01-01T06:00:00.000Z','2027-01-01','True January 1 midnight in Tulsa'],
 ['2027-01-01T07:10:00.000Z','2027-01-01','True January 1 after local midnight'],
 ['2026-03-08T07:59:00.000Z','2026-03-08','Spring DST first hour'],
 ['2026-03-08T08:01:00.000Z','2026-03-08','Spring DST jumped hour'],
 ['2026-11-01T06:30:00.000Z','2026-11-01','First autumn repeated hour'],
 ['2026-11-01T07:30:00.000Z','2026-11-01','Second autumn repeated hour'],
 ['2026-12-31','2026-12-31','Legacy date-only record must remain its literal date'],
 ['2027-01-01T09:30:00+03:00','2027-01-01','Timezone offsets normalized to Tulsa calendar']
]){
 eq(expenseBusinessDay(instant),day,label);
 eq(expenseBusinessDateLabel(instant),Number(day.slice(5,7))+'/'+Number(day.slice(8,10))+'/'+day.slice(0,4),'Human Business date agrees with '+label);
}
for(const invalid of ['','tomorrow','2026-02-30T12:00:00Z','2026-02-30','2026-12-31T23:00:00','2026-12-31T23:00:00+abc','2026-00-31T00:00:00Z']){
 eq(expenseBusinessDay(invalid),null,'Unverifiable tax date refused '+invalid);
 eq(expenseBusinessDateLabel(invalid),'Date unavailable','No invented date label for '+invalid);
}
console.log('PASS '+checks+'/'+checks+': purchase-date/Tulsa tax-year conversions including UTC rollover, DST, invalid dates and exact display labels.');
