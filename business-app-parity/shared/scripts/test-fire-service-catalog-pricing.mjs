/** Protect owner-confirmed FIRE pricing in the single shared LIVE/DR/staging catalog.
 * This is an isolated source regression: it does not send an estimate or edit
 * existing historical line items, invoices or customer records.
 */
import assert from 'node:assert/strict';
import {FIRE_SERVICES} from '../lib/fire-services.ts';

const expected=new Map([
  ['house-wash',{rate:22,unit:'sq ft'}],
  ['gutters',{rate:175,unit:'linear ft'}],
  ['gutter-guards',{rate:100,unit:'linear ft'}],
  ['fence',{rate:40,unit:'sq ft'}],
  ['trash-bins',{rate:2500,unit:'set of 2 bins'}],
  ['windows',{rate:700,unit:'window'}],
  ['windows-2f',{rate:1100,unit:'window'}],
  ['french-windows-1f',{rate:1200,unit:'window'}],
  ['french-windows-2f',{rate:1800,unit:'window'}],
]);
let checks=0;
assert.equal(FIRE_SERVICES.length,30,'Preserve 30 existing service choices and ordering');checks++;
const ids=FIRE_SERVICES.map(service=>service.id);
assert.equal(new Set(ids).size,ids.length,'No duplicate service identifiers');checks++;
const lookup=new Map(FIRE_SERVICES.map(service=>[service.id,service]));
for(const [id,{rate,unit}] of expected){
  const actual=lookup.get(id);
  assert.ok(actual,'Service missing: '+id);checks++;
  assert.equal(actual.rate,rate,'Owner-approved price drift for '+id);checks++;
  assert.equal(actual.unit,unit,'Incorrect pricing unit for '+id);checks++;
  assert.ok(Number.isSafeInteger(actual.rate) && actual.rate>=0);checks++;
}
assert.equal(lookup.get('house-wash').rate*2000,44000,'2,000 sq ft house wash should be $440');checks++;
assert.equal(lookup.get('trash-bins').rate*1,2500,'One set of two bins should be $25');checks++;
assert.equal(lookup.get('gutters').rate*100,17500,'100 linear feet gutters should be $175');checks++;
assert.equal(lookup.get('gutter-guards').rate*100,10000,'100 linear feet existing guards should be $100');checks++;
assert.equal((lookup.get('gutters').rate+lookup.get('gutter-guards').rate)*100,27500,
  '100 linear feet both services should be $275 before discounts');checks++;
// Test scope excludes service-specific custom zero-rate entries and historical
// estimates (existing contract line prices MUST NOT be rewritten).
console.log('PASS: '+checks+' FIRE shared service-catalog rate, unit, identity and integer arithmetic checks.');
