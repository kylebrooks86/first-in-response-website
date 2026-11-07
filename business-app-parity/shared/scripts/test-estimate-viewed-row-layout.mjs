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
  ui.includes('<EstimateSignedBadge signedAt={estimate.signedAt} signedName={estimate.signedName}/></span></div><strong className="customer-estimate-price">'),
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
const statuses=[
  ['draft','FileText'],['sent','Mail'],['viewed','Eye'],
  ['approved','CheckCircle2'],['scheduled','CalendarDays'],
  ['completed','Check'],['declined','X']
];
for(const [status,icon] of statuses){
  check(ui.includes(status+':{Icon:'+icon+',tone:"'+status+'"')&&
    css.includes('.estimate-lifecycle-badge.'+status),

    'Status '+status+' has a distinct meaningful icon and color token');
}
check(ui.includes('actual delivery is not verified')&&
  ui.includes('viewer identity unverified')&&
  !ui.includes('Customer viewed this estimate'),
  'Sent and opened states never imply confirmed delivery or viewer identity');
const primary=ui.match(/<EstimateStatusBadge status=\{estimate\.status\}/g)||[];
const signed=ui.match(/<EstimateSignedBadge signedAt=\{estimate\.signedAt\}/g)||[];
check(primary.length===5&&signed.length===4,
  'Primary status icon in Home, customer history, pipeline, Estimates list, job detail; Signed milestone in all four list views');
check(ui.includes('!signedAt||!Number.isFinite(Date.parse(signedAt))||!signedName?.trim()'),
  'Agreement Signed badge requires a saved timestamp and nonempty signed name');
check(css.includes('.estimate-status-indicators{')&&
  css.includes('flex-wrap:wrap;')&&
  css.includes('[data-theme="dark"] .estimate-lifecycle-badge'),
  'Status indicator group wraps on mobile and has dark-mode contrast');

console.log('PASS: Estimate eye indicator and right-aligned prices SOURCE CONTRACT; no hosted actions.');
