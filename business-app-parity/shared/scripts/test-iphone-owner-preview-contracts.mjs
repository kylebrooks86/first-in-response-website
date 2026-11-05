/** FIRE Gate 8: exact owner-only previews and deliberately native return/navigation.
 * The pinned vinext client Link handler threw during a real built QA HTTP test,
 * so previews use plain same-tab anchors with no speculation. Closing calls
 * location.replace for an exact owner record and avoids history pollution.
 * All data here is static source or synthetic: no hosted/customer reads or writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const root=resolve(process.argv[2]||'.');
const read=path=>readFileSync(resolve(root,path),'utf8');
const current={
 dashboard:read('app/dashboard.tsx'),
 estimate:read('app/estimate/[token]/page.tsx'),
 invoice:read('app/invoice/[token]/page.tsx'),
 returnLink:read('components/owner-preview-return-link.tsx'),
 css:read('app/globals.css'),
};
let checks=0;
function check(value,description){assert.ok(value,description);checks++;}
function elements(code,name){
 const file=ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 check(file.parseDiagnostics.length===0,name+' TSX must parse');
 const result=[];
 function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const attrs={};
   for(const attr of node.attributes.properties){
    if(ts.isJsxAttribute(attr))attrs[attr.name.getText(file)]=attr.initializer?.getText(file)??true;
   }
   result.push({tag:node.tagName.getText(file),attrs,source:node.getText(file)});
  }
  ts.forEachChild(node,visit);
 }
 visit(file);return result;
}
function verify(s){
 const dash=elements(s.dashboard,'dashboard.tsx');
 const estimate=elements(s.estimate,'estimate/page.tsx');
 const invoice=elements(s.invoice,'invoice/page.tsx');
 const returnNodes=elements(s.returnLink,'owner-preview-return-link.tsx');
 const previewAnchors=dash.filter(n=>n.tag==='a'&&String(n.attrs.href).includes('ownerPreview=1'));
 const find=(part)=>previewAnchors.find(n=>String(n.attrs.href).includes(part));
 const ownerEstimate=find('/estimate/');
 const ownerInvoice=find('from=estimate');
 const customerInvoice=find('from=customer');
 const invoicesWorkspace=find('from=invoices');
 check(!s.dashboard.includes('import Link from "next/link"')&&
   !s.estimate.includes('import Link from "next/link"')&&
   !s.invoice.includes('import Link from "next/link"'),
  'Owner preview routes must not invoke the known-failing vinext next/link handler');
 check(previewAnchors.length===4&&ownerEstimate&&ownerInvoice&&customerInvoice&&invoicesWorkspace,
   'All four exact owner-record preview routes remain directly navigable');
 for(const [label,anchor] of [['owner estimate',ownerEstimate],['owner invoice',ownerInvoice],['customer invoice',customerInvoice],['invoice list',invoicesWorkspace]]){
  check(anchor.tag==='a'&&!Object.hasOwn(anchor.attrs,'prefetch')&&
    !Object.hasOwn(anchor.attrs,'onClick'),label+' is a native link without speculative or client-router navigation');
  check(String(anchor.attrs.href).includes('encodeURIComponent('),label+' encodes exact saved token');
  check(!Object.hasOwn(anchor.attrs,'target'),label+' stays in the authenticated same tab');
 }
 check(String(ownerEstimate.attrs.href).includes('ownerPreview=1')&&
   s.dashboard.includes('estimate.shareToken&&!["superseded","declined"].includes(estimate.status)&&<a'),
   'Only an eligible saved estimate exposes its owner-only customer preview');
 check(String(ownerInvoice.attrs.href).includes('ownerPreview=1&from=estimate')&&
   String(customerInvoice.attrs.href).includes('ownerPreview=1&from=customer')&&
   String(invoicesWorkspace.attrs.href).includes('ownerPreview=1&from=invoices'),
   'Invoice preview preserves exact originating workspace');
 for(const [label,source,nodes] of [['estimate',s.estimate,estimate],['invoice',s.invoice,invoice]]){
  const close=nodes.filter(n=>n.tag==='OwnerPreviewReturnLink');
  check(close.length===1,label+' provides one guarded Close control, not duplicate navigation');
  check(String(close[0].attrs.href).includes('encodeURIComponent(')||close[0].attrs.href==='{returnHref}',
    label+' returns to the exact saved record');
  check(String(close[0].attrs.label)==='"Close '+label+' preview"',
    label+' Close control retains its accessible name');
  check(source.includes('await getChatGPTUser()')&&
    source.includes("?.email?.toLowerCase()==='kylebrooks8605@gmail.com'"),
    label+' server authorization requires authenticated owner, not forged query');
  check(source.includes(label==='estimate'?
    'ownerPreview&&<><OwnerPreviewTheme/><OwnerPreviewReturnLink':
    'ownerPreview?<><OwnerPreviewTheme/><OwnerPreviewReturnLink'),
    label+' return control is rendered only for authenticated owner');
 }
 check(s.returnLink.includes('"use client"')&&
   s.returnLink.includes('window.location.replace(url.href)')&&
   s.returnLink.includes('event.preventDefault()')&&
   s.returnLink.includes('url.origin!==window.location.origin')&&
   s.returnLink.includes('event.button!==0')&&
   s.returnLink.includes('event.metaKey')&&
   s.returnLink.includes('event.ctrlKey')&&
   s.returnLink.includes('event.shiftKey')&&
   s.returnLink.includes('event.altKey'),
   'Owner Close uses same-origin native document return with history replacement; modified clicks remain standard');
 check(returnNodes.filter(n=>n.tag==='a'&&n.attrs.href==='{href}'&&n.attrs['aria-label']==='{label}').length===1,
   'Owner Close is a real accessible href and continues working without JavaScript');
 check(s.invoice.includes("from==='customer'?")&&s.invoice.includes('customerSection=invoices')&&
   s.invoice.includes("from==='invoices'?"),
   'Invoice preview Close retains originating customer/invoice section context');
 const mobile=s.css.match(/@media\s*\(max-width:\s*760px\)\s*and\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/);
 check(Boolean(mobile),'Mobile dialog motion reduction is scoped to narrow coarse-pointer devices');
 if(mobile){
  check(mobile[1].includes('[data-slot="dialog-content"]')&&
    mobile[1].includes('[data-slot="dialog-overlay"]'),
    'Dialog content and overlay both use scoped mobile motion');
  check(mobile[1].includes('animation:none!important')&&mobile[1].includes('transition:none!important'),
    'Mobile motion reduction does not change dismissal semantics');
 }
 check(/const flagsByCustomer=useMemo\(\(\)=>\{/.test(s.dashboard)&&
   /\},\[customers,notes\]\)/.test(s.dashboard),
   'Customer note flags remain memoized by saved customers and notes only');
}
verify(current);
// Mutations MUST fail in the actual source contract; do not waive privacy or
// navigation requirements merely because the revised test itself passes.
for(const [label,change] of [
 ['client-router preview reintroduced',s=>({...s,dashboard:s.dashboard.replace('<a href={`/estimate/','<Link href={`/estimate/')})],
 ['preview in an unmanaged new tab',s=>({...s,dashboard:s.dashboard.replace('aria-label="Open customer-facing estimate preview"','target="_blank" aria-label="Open customer-facing estimate preview"')})],
 ['owner Close pollutes browser history',s=>({...s,returnLink:s.returnLink.replace('window.location.replace(url.href)','window.location.assign(url.href)')})],
 ['owner authentication gating removed',s=>({...s,estimate:s.estimate.replace('ownerPreview&&<><OwnerPreviewTheme/>','true&&<><OwnerPreviewTheme/>')})],
 ['mobile coarse pointer rule removed',s=>({...s,css:s.css.replace('@media (max-width:760px) and (pointer:coarse)','@media (min-width:761px) and (pointer:fine)')})],
]){
 assert.throws(()=>verify(change(current)),{name:'AssertionError'},label+' must be rejected');
 checks++;
}
console.log('PASS '+checks+' owner-preview real-anchor privacy/navigation and mobile dialog source checks, with five negative controls; offline only. Physical iPhone Safari acceptance remains OPEN.');
