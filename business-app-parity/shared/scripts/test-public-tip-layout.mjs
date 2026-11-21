import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const css=readFileSync('app/globals.css','utf8');
// Resolve the actual competing selector rules at each breakpoint. This is a
// stylesheet contract test, not a browser layout or screenshot simulation.
const matchesMedia=(params,width)=>{
 const constraints=[...params.matchAll(/\((min|max)-width\s*:\s*(\d+)px\)/g)];
 if(!constraints.length)throw new Error('Unsupported media condition '+params);
 return constraints.every(([,kind,n])=>kind==='min'?width>=Number(n):width<=Number(n));
};
function effective(text,selector,width,container){
 const result={};let priority={};
 postcss.parse(text).walkRules(rule=>{
  for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&parent.name==='media'&&!matchesMedia(parent.params,width))return;
  for(const candidate of rule.selector.split(',').map(s=>s.trim())){
   const target=candidate.startsWith(container+' ')?candidate.slice(container.length+1):candidate;
   if(target!==selector)continue;
   const rank=(candidate.match(/\./g)||[]).length;
   rule.walkDecls(d=>{if((priority[d.prop]??-1)<=rank){result[d.prop]=d.value;priority[d.prop]=rank;}});
  }
 });return result;
}
let cases=0;
for(const container of ['.invoice-portal','.pay-card'])for(const width of [320,375,390,430,520,640,1363]){
 assert.equal(effective(css,'.final-tip-options',width,container)['grid-template-columns'],'repeat(2,minmax(0,1fr))');
 assert.equal(effective(css,'.final-tip-options button:last-child',width,container)['grid-column'],'1 / -1');
 const button=effective(css,'.final-tip-options button',width,container);assert.equal(button['flex-direction'],'column');assert.equal(button['min-height'],'62px');
 const card=effective(css,'.final-tip-selector',width,container);assert.equal(card['background'],'#fff');assert.equal(card['border-radius'],'16px');
 cases++;
}
// Prove a reintroduced desktop override is rejected by the same resolver.
const regression=css+'\n@media(min-width:640px){.invoice-portal .final-tip-options{grid-template-columns:repeat(5,minmax(0,1fr))}.invoice-portal .final-tip-options button:last-child{grid-column:auto}}';
assert.notEqual(effective(regression,'.final-tip-options',1363,'.invoice-portal')['grid-template-columns'],'repeat(2,minmax(0,1fr))');
assert.notEqual(effective(regression,'.final-tip-options button:last-child',1363,'.invoice-portal')['grid-column'],'1 / -1');cases++;
// Both public document routes still invoke the same component and retain guards.
for(const path of ['app/invoice/[token]/page.tsx','app/pay/[id]/page.tsx']){
 const source=readFileSync(path,'utf8');assert.match(source,/<PayButton /);assert.match(source,/tipBaseCents=/);
}
const component=readFileSync('app/pay/[id]/pay-button.tsx','utf8');
assert.match(component,/useState<"0"\|"5"\|"10"\|"15"\|"custom">\("0"\)/);
assert.match(component,/paymentType === "balance"/);assert.match(component,/disabled=\{loading\} aria-pressed=/);cases++;
console.log(`PASS: ${cases}/${cases} public tip layout contracts (both routes, seven widths, conflicting desktop override caught, shared final-only component retained). Stylesheet checks only; browser/mobile appearance remains unverified.`);
