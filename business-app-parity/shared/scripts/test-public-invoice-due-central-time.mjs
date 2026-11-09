/** Real invoiceDueLabel AST regression in multiple server/device timezones.
 * No provider, browser, Cloudflare, D1, or customer records are touched.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const source=readFileSync('app/invoice/[token]/page.tsx','utf8');
const ast=ts.createSourceFile('invoice-page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const variable=ast.statements.find(node=>ts.isVariableStatement(node)&&
 node.declarationList.declarations.some(item=>item.name.getText(ast)==='invoiceDueLabel'));
assert.ok(variable,'Invoice due date formatting must use the real public invoice helper.');
const exported='export '+variable.getText(ast);
const moduleText=ts.transpileModule(exported,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const uri='data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64');
const checks=String.raw`
const {invoiceDueLabel}=await import(${JSON.stringify(uri)});
import assert from 'node:assert/strict';
assert.equal(invoiceDueLabel(null,'2026-11-05T12:00:00-06:00'),'Payment due on receipt');
assert.equal(invoiceDueLabel('2026-11-05T23:30:00-06:00','2026-11-05T00:30:00-06:00'),'Payment due on receipt',
 'Same Tulsa date across different UTC days should remain due on receipt.');
assert.equal(invoiceDueLabel('2026-11-06T00:30:00-06:00','2026-11-05T23:30:00-06:00'),'Payment due November 6, 2026',
 'Different Tulsa dates within one UTC day should display the actual Tulsa due day.');
assert.equal(invoiceDueLabel('2026-07-06T00:30:00-05:00','2026-07-05T23:30:00-05:00'),'Payment due July 6, 2026',
 'Daylight-saving dates should not use the UTC date.');
assert.equal(invoiceDueLabel('2026-03-08T03:30:00-05:00','2026-03-08T01:30:00-06:00'),'Payment due on receipt',
 'Central spring-forward transition remains one local business day.');
assert.equal(invoiceDueLabel('2026-11-10T08:00:00-06:00','2026-11-05T23:55:00-06:00'),'Payment due November 10, 2026');
`;
for(const zone of ['America/Chicago','UTC','Asia/Seoul']){
 const result=spawnSync(process.execPath,['--input-type=module','--eval',checks],{
  cwd:process.cwd(),env:{...process.env,TZ:zone},encoding:'utf8',timeout:12000
 });
 assert.equal(result.status,0,zone+': '+(result.stderr||result.stdout));
 console.log('PASS invoice public due date matches Tulsa calendar in '+zone);
}
console.log('PASS 18/18 real public invoice local-day cases (3 process timezones); read-only source fixture.');
