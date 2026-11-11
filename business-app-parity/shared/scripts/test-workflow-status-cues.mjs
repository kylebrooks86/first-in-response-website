/** Owner-only visual affordances: no saved-data modifications or provider calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('app/dashboard.tsx','utf8');
const closeout=readFileSync('components/job-closeout-history.tsx','utf8');
const css=readFileSync('app/globals.css','utf8');
let checks=0;
function check(ok,label){assert.ok(ok,label);checks++;}
for(const [section,Icon,label] of [
 ['estimates','ClipboardList','Estimates'],['payments','CreditCard','Payments'],
 ['invoices','Receipt','Invoices'],['photos','Images','Photos'],
 ['messages','MessageSquareText','Messages'],['notes','StickyNote','Notes']
]){
 const re=new RegExp('setSection\\("'+section+'"\\)\\}><'+Icon+' className="customer-tab-icon" aria-hidden="true"\\/>'+label);
 check(re.test(ui),section+' keeps labeled customer navigation with decorative icon');
}
check(css.includes('.customers-view .record-tabs .customer-tab-icon')&&
 css.includes('.customers-view .record-tabs button:focus-visible')&&
 css.includes('flex-wrap:wrap')&&css.includes('min-height:44px'),
 'Customer tab indicators retain keyboard access and narrow-screen readable layout');
check(ui.includes('className="customer-invoice-state"><InvoiceStatusIndicator invoice={invoice}/>')&&
 ui.includes('!invoice.paymentReviewPending&&Number(invoice.paymentOverageOpen)===0'),
 'Customer invoice reuses existing truthful payment-review priority and does not show a due date during review');
check(ui.includes('className={"followup-urgency rounded-full')&&
 ui.includes('urgency.bucket==="past-target"||urgency.bucket==="review"?<AlertTriangle aria-hidden="true"/>')&&
 ui.includes('urgency.bucket==="upcoming"?<CalendarDays aria-hidden="true"/>:<Clock3 aria-hidden="true"/>'),
 'Follow-up urgency keeps saved classification and accessible text with consistent icon');
check(css.includes('.app-shell .followup-urgency svg')&&
 ui.includes('bg-rose-100 text-rose-900')&&ui.includes('bg-sky-100 text-sky-900'),
 'Existing semantic follow-up colors retained with restrained icon sizing');
check(ui.includes('payment-review-state')&&
 ui.includes('Prepared · send unconfirmed')&&ui.includes('No confirmed review request'),
 'Paid-job review state never claims a prepared request was delivered');
for(const [state,Icon] of [
 ['due','Clock3'],['waiting','Clock3'],['snoozed','CalendarDays'],['received','BadgeCheck'],['needs-review','AlertTriangle']
]){
 check(closeout.includes(state+':'+Icon)||closeout.includes("'"+state+"':"+Icon),
  'Review closeout '+state+' has a distinct source-backed icon');
 check(css.includes('.closeout-state.'+state)||state==='needs-review'&&css.includes('.closeout-state.needs-review'),
  'Review closeout '+state+' has a color style in addition to a text label');
}
check(closeout.includes('<CloseoutStatus state={item.state}/>')&&
 closeout.includes('{labels[state]}')&&closeout.includes('<Icon aria-hidden="true"/>'),
 'Read-only review progress always retains visible status text; icon does not replace label');
check(css.includes('@media(forced-colors:active)')&&
 css.includes('.app-shell .payment-review-state,.app-shell .closeout-state'),
 'High-contrast mode preserves readable status boundaries');
console.log('PASS '+checks+' source-backed customer, follow-up, billing and review status affordances; no writes or sends.');
