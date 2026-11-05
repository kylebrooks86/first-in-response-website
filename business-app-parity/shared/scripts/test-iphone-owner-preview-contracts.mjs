/** FIRE Gate 8: real source/TSX contract checks for owner-preview navigation and
 * coarse-pointer dialog responsiveness. Synthetic, offline, no hosted reads/writes.
 * These guards do NOT measure native iOS frame timing or constitute QA acceptance.
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
  css:read('app/globals.css'),
};
let checks=0;
function check(value,description){assert.ok(value,description);checks++;}
function parsedLinks(code,name){
  const file=ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  check(file.parseDiagnostics.length===0,name+' TSX must parse');
  const links=[];
  function visit(node){
    if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(file)==='Link'){
      const attrs={};
      for(const attr of node.attributes.properties){
        if(!ts.isJsxAttribute(attr))continue;
        attrs[attr.name.getText(file)]=attr.initializer?.getText(file)??true;
      }
      links.push({attrs,source:node.getText(file)});
    }
    ts.forEachChild(node,visit);
  }
  visit(file);
  return links;
}
function verify(s){
  check(s.dashboard.includes('import Link from "next/link";'),'Dashboard imports Next client navigation');
  check(s.estimate.includes('import Link from "next/link";'),'Estimate portal imports Next client navigation');
  check(s.invoice.includes('import Link from "next/link";'),'Invoice portal imports Next client navigation');
  const dash=parsedLinks(s.dashboard,'dashboard.tsx');
  const estimate=parsedLinks(s.estimate,'estimate/page.tsx');
  const invoice=parsedLinks(s.invoice,'invoice/page.tsx');
  const find=(rows,part)=>rows.find(item=>String(item.attrs.href).includes(part));
  const ownerEstimate=find(dash,'/estimate/');
  const ownerInvoice=find(dash,'/invoice/');
  const customerInvoice=dash.find(x=>String(x.attrs.href).includes('from=customer'));
  check(dash.length===3&&ownerEstimate&&ownerInvoice&&customerInvoice,
    'All three saved owner/customer record previews use original Next links');
  for(const [label,link] of [['owner estimate',ownerEstimate],['owner invoice',ownerInvoice],['customer invoice',customerInvoice]]){
    check(link.attrs.prefetch==='{false}',label+' must not speculatively fetch private tokens');
    check(String(link.attrs.href).includes('encodeURIComponent('),label+' encodes its saved token');
    check(!link.source.includes('target="_blank"'),label+' does not open an unmanaged page');
  }
  check(String(ownerEstimate.attrs.href).includes('ownerPreview=1')&&
    s.dashboard.includes('estimate.shareToken&&!["superseded","declined"].includes(estimate.status)&&<Link'),
    'Only an eligible saved estimate exposes owner preview');
  check(String(ownerInvoice.attrs.href).includes('ownerPreview=1&from=estimate')&&
    String(customerInvoice.attrs.href).includes('ownerPreview=1&from=customer'),
    'Invoice navigation preserves the source record context');

  for(const [label,source,links] of [['estimate',s.estimate,estimate],['invoice',s.invoice,invoice]]){
    check(links.length===1,label+' has exactly one owner-only return link');
    const close=links[0];
    check(close.attrs.prefetch==='{false}'&&close.attrs.replace===true,
      label+' close must avoid speculative reads and replace browser history');
    check(String(close.attrs.href).includes('encodeURIComponent(')||close.attrs.href==='{returnHref}',
      label+' close returns to the exact saved record');
    check(source.includes('await getChatGPTUser()')&&
      source.includes("?.email?.toLowerCase()==='kylebrooks8605@gmail.com'"),
      label+' owner preview requires authenticated owner, not a query flag alone');
    check(source.includes('ownerPreview&&<><OwnerPreviewTheme/><Link'),
      label+' close/control is gated by authenticated owner preview');
  }
  check(s.invoice.includes("from==='customer'?")&&s.invoice.includes('customerSection=invoices')&&
    s.invoice.includes("from==='invoices'?"),
    'Invoice preview returns to the exact originating workspace');

  const mobile=s.css.match(/@media\s*\(max-width:\s*760px\)\s*and\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/);
  check(Boolean(mobile),'Mobile dialog motion reduction is scoped to narrow coarse-pointer devices');
  if(mobile){
    check(mobile[1].includes('[data-slot="dialog-content"]')&&mobile[1].includes('[data-slot="dialog-overlay"]'),
      'Dialog content and overlay both have the mobile rule');
    check(mobile[1].includes('animation:none!important')&&mobile[1].includes('transition:none!important'),
      'Mobile dialog motion is disabled without altering dismissal logic');
  }
  check(/const flagsByCustomer=useMemo\(\(\)=>\{/.test(s.dashboard)&&/\},\[customers,notes\]\)/.test(s.dashboard),
    'Customer note flags index only changes when customers or notes change');
}
verify(current);
// Prove the source guard fails against representative regressions, not only
// passing known strings. This does not generate or deploy altered app source.
for(const [label,change] of [
  ['full-page preview fallback',s=>({...s,dashboard:s.dashboard.replace('<Link href={\`/estimate/','<a href={\`/estimate/')} )],
  ['private link speculative prefetch',s=>({...s,dashboard:s.dashboard.replace('prefetch={false} aria-label="Open customer-facing estimate preview"','prefetch={true} aria-label="Open customer-facing estimate preview"')})],
  ['owner close history pollution',s=>({...s,estimate:s.estimate.replace('prefetch={false} replace aria-label="Close estimate preview"','prefetch={false} aria-label="Close estimate preview"')})],
  ['mobile dialog animation accidentally restored',s=>({...s,css:s.css.replace('@media (max-width:760px) and (pointer:coarse)','@media (min-width:761px) and (pointer:fine)')})],
]){
  assert.throws(()=>verify(change(current)),{name:'AssertionError'},label+' must be rejected');
  checks++;
}
console.log('PASS '+checks+' FIRE owner-preview navigation and mobile dialog source-contract checks, including four negative controls; offline only. Physical iPhone Safari acceptance remains open.');
