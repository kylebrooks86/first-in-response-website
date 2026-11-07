/** Source-only estimate visibility and fixed-column regression.
 * No HTTP requests, D1, customer records, Cloudflare credentials or writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const check=(predicate,label)=>{
  assert.ok(predicate,'FIRE estimate UI contract: '+label);
  console.log('PASS: '+label);
};
// A saved first-view timestamp is an event, not proof of customer identity.
check(ui.includes('function EstimateViewedBadge({firstViewedAt}')&&
  ui.includes('Number.isFinite(Date.parse(firstViewedAt))')&&
  ui.includes('viewer identity unverified')&&
  ui.includes('<Eye aria-hidden="true"/> Viewed'),
  'Eye badge depends on saved firstViewedAt; clearly avoids claiming customer identity');
const badges=ui.match(/<EstimateViewedBadge firstViewedAt=\{estimate\.firstViewedAt\}\/>/g)||[];
check(badges.length===4,
  'Customer history, Home recent estimates, Estimates list and pipeline share the same badge');
check(ui.includes('<button className="customer-record record-button customer-estimate-record"')&&
  ui.includes('<strong className="customer-estimate-price">')&&
  ui.includes('<EstimateViewedBadge firstViewedAt={estimate.firstViewedAt}/></div><strong className="customer-estimate-price">'),
  'Customer estimate status, view badge and amount stay bound to same estimate row');
check(css.includes('.customer-record.customer-estimate-record{')&&
  css.includes('grid-template-columns:minmax(0,1fr) minmax(74px,max-content) 18px;')&&
  css.includes('.customer-estimate-record>.customer-estimate-price{')&&
  css.includes('justify-self:end;')&&
  css.includes('font-variant-numeric:tabular-nums;'),
  'Customer estimate amount is fixed right-aligned grid slot with tabular figures');
check(css.includes('[data-theme="dark"] .estimate-viewed-indicator{')&&
  css.includes('@media(max-width:430px){\n  .customer-record.customer-estimate-record{'),
  'Badge supports dark theme and narrow mobile price grid');
check(!ui.includes('estimate.status==="sent"&&estimate.firstViewedAt?" · Viewed"')&&
  !ui.includes('estimate.status==="sent"&&savedDate(estimate.firstViewedAt)?"Viewed"'),
  'No duplicate or sent-only viewed indicator; approved/scheduled historical views remain visible');
console.log('PASS: Estimate eye indicator and right-aligned prices SOURCE CONTRACT; no hosted actions.');
