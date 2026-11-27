/** Owner-only preview exit contract for exceptional token states.
 * Source-only, offline: no valid URLs, owner sessions, provider reads or first-view writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const estimate=readFileSync(new URL('../app/estimate/[token]/page.tsx',import.meta.url),'utf8');
const invoice=readFileSync(new URL('../app/invoice/[token]/page.tsx',import.meta.url),'utf8');
const exit=readFileSync(new URL('../components/owner-preview-return-link.tsx',import.meta.url),'utf8');
let passed=0;
const check=(condition,name)=>{assert.ok(condition,name);passed++;console.log('PASS '+name);};
check(estimate.includes("previewRequested==='1'?await getChatGPTUser():null")&&
 estimate.includes("const ownerPreview=Boolean(previewUser?.email?.toLowerCase()"),
 'A query-string ownerPreview hint alone does not grant estimate owner access');
check(invoice.includes("requestedPreview==='1'?await getChatGPTUser():null")&&
 invoice.includes("const ownerPreview=previewOwner?.email?.toLowerCase()"),
 'A query-string ownerPreview hint alone does not grant invoice owner access');
check(estimate.includes('const ownerPreviewExit=(id?:string)=>ownerPreview?')&&
 estimate.includes('label="Close estimate preview"')&&
 estimate.includes('href={id?`/?openEstimate=${encodeURIComponent(id)}`:"/"}'),
 'Unavailable estimate owner exit returns home; known estimate returns exact ID');
for(const [name,needle] of [
 ['missing estimate','if(!row)return <main'],
 ['withdrawn estimate','if(row.status==="declined")return <main'],
 ['signed revised agreement','if(held&&acceptedRevision)return <main'],
 ['revised-deposit hold','if(held)return <main'],
 ['changed deposit while opening','return <main className={`pay-page${ownerPreview?" owner-estimate-preview":""}`}>{ownerPreviewExit(row.id)}<section className="pay-card"><h1>Updated estimate required'],
 ['unverified discount','}catch{return <main className={`pay-page${ownerPreview?" owner-estimate-preview":""}`}>{ownerPreviewExit(row.id)}']
]){
 check(estimate.includes(needle),name+' has a guarded owner preview return path');
}
check(invoice.includes('const ownerMissingExit=ownerPreview?')&&
 invoice.includes('href="/" label="Close invoice preview"')&&
 invoice.includes('if (!row) return <main className={`pay-page invoice-page${ownerPreview?" owner-estimate-preview":""}`}>{ownerMissingExit}'),
 'Missing invoice has authenticated Close link, never public owner controls');
check(invoice.includes('const close=ownerPreview?')&&
 invoice.includes('if(!state.safe)return <main')&&invoice.includes('>{close}<section'),
 'Invoice review hold and success share existing owner Close');
check(exit.includes('if(url.origin!==window.location.origin)return')&&
 exit.includes('window.location.replace(url.href)')&&
 exit.includes('aria-label={label}'),
 'Owner preview exit preserves explicit safe same-origin navigation and accessible name');
console.log('PASS '+passed+' owner-only preview exit contract checks; offline, no state changes.');
