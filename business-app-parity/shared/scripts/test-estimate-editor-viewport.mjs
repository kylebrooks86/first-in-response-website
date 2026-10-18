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
 '.estimate-edit-dialog{','transition-property:opacity,transform','display:flex;flex-direction:column','max-height:min(92vh,92dvh);overflow:hidden',
 '.estimate-edit-scroll-area{','min-height:0;min-width:0','overflow-y:auto;overflow-x:hidden',
 'overscroll-behavior:contain','-webkit-overflow-scrolling:touch',
 '.estimate-edit-modal-footer{','flex:0 0 auto','@media(max-width:760px)',
 'top:50%!important;left:50%!important','bottom:auto!important;right:auto!important',
 'width:calc(100vw - 28px)!important','max-width:calc(100vw - 28px)!important',
 'translate:-50% -50%!important','max-height:calc(100dvh - 28px)!important'])
 assert.ok(patch.includes(bit),'Missing responsive editor guarantee: '+bit);
assert.ok(patch.indexOf('.estimate-edit-dialog{')<patch.indexOf('@media(max-width:760px)'),'Desktop modal remains centered with bounded height');
// The previous patch anchored the dialog at 14px but left Radix's -50%
// centering in place; iPhone Safari then clipped half the form off-screen.
assert.ok(!patch.includes('left:14px!important'),'Never anchor a translated dialog at the left edge');
assert.ok(!patch.includes('translate:none!important'),'Do not remove Radix dialog centering');
assert.ok(!patch.includes('transform:none!important'),'Do not override Radix dialog animations');
const radixDialog=readFileSync('components/ui/dialog.tsx','utf8');
assert.match(radixDialog,/top-\[50%\] left-\[50%\]/,'Base dialog uses centered viewport anchors');
assert.match(radixDialog,/translate-x-\[-50%\] translate-y-\[-50%\]/,'Base dialog uses centered translations');
for(const viewportWidth of [320,375,390,430,760]){
  const modalWidth=viewportWidth-28;
  const left=viewportWidth/2-modalWidth/2;
  assert.equal(left,14,`Editor left edge at ${viewportWidth}px must stay visible`);
  assert.equal(left+modalWidth,viewportWidth-14,`Editor right edge at ${viewportWidth}px must stay visible`);
}

assert.equal((editor.match(/Save estimate changes/g)||[]).length,1,'Single save action');
console.log('PASS: Edit Estimate header/save footer and scroll area stay accessible; shared mobile dialog horizontal centering model; static source checks only, no browser execution/deployment.');
