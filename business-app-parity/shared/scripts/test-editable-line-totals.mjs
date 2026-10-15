/** No-op estimate/invoice edits must not round stored historical cents. */
import assert from 'node:assert/strict';
import {editMoneyLine,editableLineTotalCents,restoreEditableLineMoney} from '../lib/editable-line-totals.ts';
let checks=0;
const eq=(actual,expected,name)=>{assert.deepEqual(actual,expected,name);checks++;};
const historical={id:'saved-invoice-item',name:'Historical service',serviceId:'gutters',
  unit:'linear ft',description:'Original agreed work',quantity:3,
  ...restoreEditableLineMoney(3,2000)};
eq(historical.unitRateCents,667,'Approximate 667 cents per 3 cannot reconstruct 2000');
eq(editableLineTotalCents(historical),2000,'Preserve exact historical $20 even though 3*667=2001');
eq(editableLineTotalCents(editMoneyLine(historical,{description:'Updated description'})),2000,
  'Description edit cannot silently reprice historical invoices');
eq(editableLineTotalCents(editMoneyLine(historical,{quantity:4})),2668,
  'Deliberate quantity edit recalculates from displayed rate');
eq(editableLineTotalCents(editMoneyLine(historical,{unitRateCents:700})),2100,
  'Deliberate price edit recalculates');
eq(editableLineTotalCents(editMoneyLine(historical,{name:'Other service'})),2001,
  'Deliberate service change clears historical total preservation');
eq(editableLineTotalCents(editMoneyLine(historical,{serviceId:'windows'})),2001,
  'Deliberate service selection clears historical preservation');
eq(editableLineTotalCents(editMoneyLine(historical,{unit:'window'})),2001,
  'Deliberate unit change clears historical total preservation');
eq(editableLineTotalCents(editMoneyLine(historical,{quantity:3})),2001,
  'Explicitly edited quantity triggers repricing even if set back to prior quantity');
eq(historical.preservedLineTotalCents,2000,'Editable patches do not mutate saved source row');
eq(editableLineTotalCents({quantity:2000,unitRateCents:22}),44000,
  'New 2,000 sq ft house wash computes normal cents without historical preservation');
eq(editableLineTotalCents({quantity:100,unitRateCents:175}),17500,
  'New 100 lf gutter estimate uses future approved rate');
eq(editableLineTotalCents({quantity:0,unitRateCents:175}),0,
  'Empty draft does not throw when first rendered');
eq(editableLineTotalCents({quantity:Number.NaN,unitRateCents:175}),0,
  'Incomplete draft preview never crashes editor');
eq(editableLineTotalCents({quantity:1e100,unitRateCents:175}),0,
  'Unsafe multiplication must not create rounded monetary record preview');
for(const amount of [-1,0.1,Number.MAX_SAFE_INTEGER+1,NaN]){
  assert.throws(()=>restoreEditableLineMoney(3,amount),/Invalid historical service total/);checks++;
}
for(const quantity of [-1,0,NaN]){
  assert.throws(()=>restoreEditableLineMoney(quantity,100),/Invalid stored service quantity/);checks++;
}
eq(editableLineTotalCents({...restoreEditableLineMoney(3,0),quantity:3}),0,
  'Zero-dollar historic line remains unchanged until deliberate editing');
// Historical line corrections never read current service catalog rates,
// whose changes affect new estimates only.
console.log('PASS: '+checks+' exact-cent line total, historical invoice, pricing-edit, nonmutating and invalid-input protections.');
