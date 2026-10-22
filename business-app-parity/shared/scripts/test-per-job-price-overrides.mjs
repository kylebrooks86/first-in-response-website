/** Every FIRE catalog item must be a STARTING rate, editable per job.
 * No hosted customer, deployed application, or database is touched.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIRE_SERVICES} from '../lib/fire-services.ts';
import {editMoneyLine,editableLineTotalCents} from '../lib/editable-line-totals.ts';

const dir=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,dir),'utf8');
const source=read('app/dashboard.tsx');
const slices=[
  ['new estimate',source.slice(source.indexOf('function NewEstimate('),source.indexOf('function DashboardView('))],
  ['existing estimate',source.slice(source.indexOf('function EditEstimateDialog('),source.indexOf('function EditInvoiceDialog('))],
  ['final invoice',source.slice(source.indexOf('function EditInvoiceDialog('),source.indexOf('function ',source.indexOf('function EditInvoiceDialog(')+20))],
];
let checks=0;
assert.equal(FIRE_SERVICES.length,30,'All 30 services must remain available');checks++;
for(const [label,editor] of slices){
  assert.ok(editor.includes('services.map((svc)=><SelectItem'),
    label+' must offer all current services from the shared catalog');checks++;
  assert.ok(editor.includes('unitRateCents:svc.rate||0'),
    label+' must prefill the quoted line with the shared starting rate');checks++;
  assert.ok((editor.includes('EstimateLinePricing')||editor.includes('updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})')),
    label+' must let owner override any per-job unit price, including high difficulty');checks++;
  assert.ok(editor.includes('updateItem(index,{quantity:Number(event.target.value)})'),
    label+' must let owner adjust quantity');checks++;
  assert.ok(editor.includes('updateItem(index,{description:event.target.value})'),
    label+' must let owner explain difficulty or scope');checks++;
  assert.ok(editor.includes('editableLineTotalCents(item)'),
    label+' must derive per-line totals from job-specific edited values');checks++;
  assert.ok((/adjustable for this (job|invoice)/.test(editor)||editor.includes('EstimateLinePricing')),
    label+' must visibly communicate prices are adjustable, not fixed');checks++;
}
for(const svc of FIRE_SERVICES){
  const original=svc.rate;
  const selected={name:svc.name,serviceId:svc.id,unit:svc.unit,
                  quantity:svc.unit==='job'?1:100,unitRateCents:svc.rate};
  const originalTotal=editableLineTotalCents(selected);
  const increased=editMoneyLine(selected,{unitRateCents:original+125});
  assert.equal(increased.unitRateCents,original+125,
    svc.name+' must permit price increase for difficult work');checks++;
  assert.equal(editableLineTotalCents(increased),originalTotal+(svc.unit==='job'?125:12500),
    svc.name+' must reflect override in estimate total');checks++;
  assert.equal(svc.rate,original,svc.name+' defaults cannot change from a custom quote');checks++;
  if(original>=25){
    const reduced=editMoneyLine(selected,{unitRateCents:original-25});
    assert.equal(reduced.unitRateCents,original-25,
      svc.name+' must allow lower special quotes where appropriate');checks++;
  }
}
for(const path of ['app/api/estimates/route.ts','app/api/estimates/[id]/route.ts',
                    'app/api/invoices/[id]/route.ts']){
  const api=read(path);
  assert.ok(api.includes('totalCents:Math.round(Number(item.totalCents))'),
    path+' must accept validated quoted line totals independently of catalog defaults');checks++;
}
assert.equal(FIRE_SERVICES.find(s=>s.id==='gutters')?.rate,150,
  'Owner-confirmed gutter default: $1.50 per linear foot');checks++;
assert.equal(FIRE_SERVICES.find(s=>s.id==='gutter-guards')?.rate,50,
  'Owner-confirmed existing gutter-guard default: $0.50 per linear foot');checks++;
assert.equal(FIRE_SERVICES.find(s=>s.id==='trash-bins')?.rate,2500,
  'Owner-confirmed trash-bin default: $25 per bin');checks++;
assert.equal(FIRE_SERVICES.find(s=>s.id==='trash-bins')?.unit,'bin',
  'Trash bins quote per bin, not by 2-bin set');checks++;
console.log('PASS: '+checks+' per-job editable rate/quantity/description, backend quoted totals, and unchanged catalog-default checks.');
