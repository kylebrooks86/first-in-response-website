/** FIRE Home visual polish source contract. Synthetic and read-only; no browser,
 * remote calls, customer records, Cloudflare resources or production writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const check=(condition,label)=>{assert.ok(condition,'FIRE Home visual polish: '+label);console.log('PASS: '+label);};
check(ui.includes('<section className="metric-grid">')&&
  ui.includes('<button className="metric-card accent"')&&
  ui.includes('className="metric-arrow"'),
  'Retains real existing metric actions and due-now emphasis');
check(css.includes('/* FIRE dashboard refinement')&&
  css.includes('.dashboard-view .metric-grid .metric-card>small{')&&
  css.includes('padding-right:30px;')&&
  css.includes('overflow-wrap:anywhere')&&
  css.includes('.dashboard-view .metric-grid .metric-card .metric-arrow{'),
  'Metric descriptions reserve room for bottom-right arrows and wrap');
check(css.includes('@media(hover:hover){')&&
  css.includes('box-shadow:0 8px 24px')&&
  css.includes('transform:translateY(-2px)')&&
  css.includes('.dashboard-view .metric-grid .metric-card:focus-visible{')&&
  css.includes('@media(prefers-reduced-motion:reduce){'),
  'Subtle hover polish honors keyboard focus and reduced motion');
check(ui.includes('{compact&&<small className="weather-scroll-hint" aria-hidden="true">Swipe to see all 7 days →</small>}')&&
  ui.includes('className="weather-days" role="region"')&&
  css.includes('.weather-strip.home-weather .weather-scroll-hint{display:none}')&&
  css.includes('@media(max-width:760px){\n  .weather-strip.home-weather .weather-scroll-hint{')&&
  css.includes('.weather-strip.home-weather .weather-simple-footer{grid-row:4}')&&
  css.includes('[data-theme="dark"] .weather-strip.home-weather .weather-scroll-hint{'),
  'Seven-day forecast has nonblocking visible narrow-screen swipe cue; footer remains reachable');
check(!css.includes('.dashboard-view button{border-color:#e32935')&&
  !css.includes('.app-shell button{border:1px solid red'),
  'Does not blanket-outline every button in red');
console.log('PASS FIRE Home subtle visual polish SOURCE CONTRACT (hosted/browser acceptance still open).');
