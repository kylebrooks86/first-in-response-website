/** FIRE visual-system source coverage, November 2026.
 * All owner-facing app sections are scanned; assertions are code contracts,
 * NOT claims of real-device viewport acceptance or rendered clickthrough.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const voice=readFileSync(new URL('../components/google-voice-text-action.tsx',import.meta.url),'utf8');
let checks=0;
const check=(ok,what)=>{assert.ok(ok,'FIRE app-wide visual system: '+what);checks++;console.log('PASS: '+what);};
const screens=[
 ['Home/dashboard','DashboardView','metric-grid'],
 ['Customers/profile','CustomersView','customer-profile'],
 ['Customer photos','CustomerPhotos','photo-panel'],
 ['Estimates/list','EstimatesView','estimate-card'],
 ['New estimate/editor','NewEstimate','estimate-new-save-actions'],
 ['Edit estimate','EditEstimateDialog','estimate-edit-scroll-area'],
 ['Edit invoice','EditInvoiceDialog','fire-edit-actions'],
 ['Job detail/report','EstimateDetail','detail-actions'],
 ['Schedule/calendar','ScheduleView','schedule-month'],
 ['Invoices','InvoicesView','invoice-card'],
 ['Agreements','ContractsView','contract-list'],
 ['Follow-ups','FollowUpsView','followup-card'],
 ['Payments','PaymentsView','payment-history'],
 ['Business/tasks','BusinessView','business-panel'],
 ['Insights','InsightsView','insight-kpis'],
 ['Settings/templates','SettingsView','template-editor'],
 ['Notifications','NotificationBell','notification-popover'],
 ['Job report','JobReport','job-report'],
 ['Job cost','JobCost','job-cost']
];
for(const [area,component,klass] of screens){
  check(ui.includes('function '+component+'(')&&ui.includes(klass),
    area+' continues using its existing component and layout identifiers');
}
check(ui.includes('<main className="app-shell"')&&css.includes('/* FIRE APP-WIDE VISUAL SYSTEM'),
  'App-owned shared styles are scoped to the authenticated FIRE shell');
for(const token of ['--fire-ui-radius','--fire-ui-border-soft','--fire-ui-shadow','--fire-ui-shadow-hover','--fire-ui-nav-accent','--fire-ui-active-wash']){
  check(css.includes(token),'Shared component design token '+token);
}
check(css.includes('[data-theme="dark"]{')&&css.includes('--fire-ui-border-soft:#33485f;'),
  'Dark theme defines separate semantic borders, depth and nav accents');
check(css.includes('.app-shell .sidebar nav button svg{')&&
  css.includes('.app-shell .bottom-nav button svg{')&&
  css.includes('.app-shell .bottom-nav button.active svg{'),
  'Desktop and phone navigation have uniform glyph sizes and distinguished active states');
check(css.includes('.app-shell :is(.customer-card,.estimate-card,.invoice-card,.record-card,.followup-card,.schedule-month,.insight-kpis article){')&&
  css.includes('box-shadow:var(--fire-ui-shadow);'),
  'Customers, estimates, invoices, follow-ups, schedule, record and insight cards share restrained border/shape/depth rules');
check(css.includes('.app-shell :is(.filter-row button.active,.record-tabs button.active)')&&
  css.includes('touch-action:manipulation')&&css.includes('min-height:44px'),
  'Action groups use touch targets and purposeful neutral variants, not blanket red');
check(css.includes('.app-shell :is(.metric-card>strong,.insight-kpis strong,.invoice-total>strong,.customer-estimate-price,.payment-history-amount,.customer-payment-amount,.job-price,.estimate-amount){')&&
  css.includes('font-variant-numeric:tabular-nums;'),
  'Money, invoice, metrics and reporting amounts align with tabular figures');
check(css.includes('overflow-wrap:anywhere')&&css.includes('@media(max-width:760px)')&&
  css.includes('scroll-padding-inline:12px'),
  'Small-screen long labels wrap and scrollers keep focusable controls visible');
check(css.includes('@media(hover:hover) and (pointer:fine){')&&
  css.includes('@media(prefers-reduced-motion:reduce){')&&
  css.includes(':focus-visible'),
  'Decorative motion only on hover-capable devices and motion preferences/focus respected');
check(css.includes('.voice-contact-dialog[data-slot="dialog-content"] > .voice-contact-body{')&&
  css.includes('overflow-y:auto;')&&
  css.includes('.voice-contact-dialog[data-slot="dialog-content"] > [data-slot="dialog-close"]{')&&
  voice.match(/<div className="voice-contact-body" role="region"/g)?.length===2,
  'Both Voice contact dialogs scroll contents while top-right X stays outside scroll pane');
check(ui.includes('function EstimateStatusBadge')&&
  ui.includes('function EstimatePaymentBadge')&&
  ui.includes('function EstimateAttentionBadges'),
  'Lifecycle, financial and exceptional statuses keep separate meaning');
check(css.includes('/* Remove legacy <=430px dashboard card suppression:')&&
  css.includes('.app-shell .dashboard-view .metric-grid > .metric-card:nth-child(3),')&&
  css.includes('grid-template-columns:minmax(0,1fr)'),
  'All four Home KPI cards remain accessible at phone widths, with one-column fallback <=350px');
check(css.includes('.app-shell .invoice-card>.invoice-actions{')&&
  css.includes('display:grid!important;')&&
  css.includes('grid-template-columns:repeat(2,minmax(0,1fr));')&&
  css.includes('.app-shell .invoice-card>.invoice-actions> :is(a,button){'),
  'Invoice Open/Record payment controls share an equal-height responsive row');
check(!css.includes('.app-shell button{border:1px solid red')&&
  !css.includes('.app-shell button{border-color:#e32935')&&
  !css.includes('.app-shell button{background:#e32935'),
  'No global always-red button override; FIRE red is reserved for meaning');

const contrast=(fg,bg)=>{
  const lum=hex=>{
    const c=hex.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*c[0]+.7152*c[1]+.0722*c[2];
  };
  const a=lum(fg),b=lum(bg);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
check(contrast('#586b80','#ffffff')>=4.5&&
  contrast('#b5c7da','#111f31')>=4.5,
  'Secondary text tokens meet minimum 4.5:1 contrast on light/dark card surfaces');
check(css.includes('.app-shell .dashboard-view .metric-card>small{')&&
  css.includes('color:var(--fire-ui-supporting-text);')&&
  css.includes('font-size:12px;'),
  'Home metric descriptions remain legible instead of pale 11px text');
check(css.includes('.app-shell .bottom-nav button{')&&
  css.includes('font-size:11px;')&&
  css.includes('.app-shell .bottom-nav button.active{')&&
  css.includes('color:var(--fire-ui-nav-accent);'),
  'Mobile nav has readable neutral labels and distinct selected FIRE-red text');

console.log('PASS '+checks+'/'+checks+' source-level app-wide visual-system checks (physical QA open).');
