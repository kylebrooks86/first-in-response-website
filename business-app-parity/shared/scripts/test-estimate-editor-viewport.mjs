import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8');
const css=readFileSync('app/globals.css','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,'Shared dashboard TSX must parse');
const start=source.indexOf('function EditEstimateDialog(');
const end=source.indexOf('function EditInvoiceDialog(',start);
assert.ok(start>=0&&end>start,'Target only EditEstimateDialog');
const editor=source.slice(start,end);
const header=editor.indexOf('className="estimate-edit-modal-header"');
const scroll=editor.indexOf('className="estimate-edit-scroll-area"');
const footer=editor.indexOf('className="estimate-edit-modal-footer"');
assert.ok(header>0&&scroll>header&&footer>scroll,'Header, scroll region and save footer stay in order');
assert.match(editor,/className="estimate-edit-scroll-area" role="region" aria-label="Estimate services and pricing" tabIndex=\{0\}/,'Scrollable region is keyboard accessible');
assert.ok(editor.indexOf('estimate-edit-items',scroll)>scroll&&editor.indexOf('edit-totals',scroll)>scroll,'All service fields and totals are inside scrolling body');
assert.ok(editor.indexOf('Save estimate changes',footer)>footer,'Save remains in the visible footer');
assert.ok(editor.indexOf('role="alert"',scroll)<footer,'Save errors are readable inside the scrolling body');
assert.ok(editor.includes('onOpenChange={setOpenSafe}'),'Dialog close behavior preserved');
assert.ok(editor.includes('onClick={()=>void save()} disabled={saving}'),'Save behavior and saving guard preserved');
const patch=css.slice(css.indexOf('/* FIRE QA: prevent iPhone Safari'));
assert.ok(patch.startsWith('/* FIRE QA:'),'Viewport patch exists');
for(const bit of [
 '.estimate-edit-dialog{','display:flex;flex-direction:column','max-height:min(92vh,92dvh);overflow:hidden',
 '.estimate-edit-scroll-area{','min-height:0;min-width:0','overflow-y:auto;overflow-x:hidden',
 'overscroll-behavior:contain','-webkit-overflow-scrolling:touch',
 '.estimate-edit-modal-footer{','flex:0 0 auto','@media(max-width:760px)',
 'top:max(12px,env(safe-area-inset-top))!important','bottom:max(12px,env(safe-area-inset-bottom))!important',
 'translate:none!important;transform:none!important','max-height:none!important'])
 assert.ok(patch.includes(bit),'Missing responsive editor guarantee: '+bit);
assert.ok(patch.indexOf('.estimate-edit-dialog{')<patch.indexOf('@media(max-width:760px)'),'Desktop modal remains centered with bounded height');
assert.equal((editor.match(/Save estimate changes/g)||[]).length,1,'Single save action');
console.log('PASS: Edit Estimate has reachable close/header and save footer, internal scroll, dynamic viewport/safe-area positioning; source-only synthetic checks; no deployment.');
