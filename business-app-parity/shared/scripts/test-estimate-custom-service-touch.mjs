/** FIRE iPhone Custom Service estimate picker — targeted source/UX contract.
 * No owner records, hosted app, provider writes, or pricing modifications.
 * Dropdown and shortcut retain one catalog-based service selection path.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};

const code=readFileSync('app/dashboard.tsx','utf8');
const tree=ts.createSourceFile('dashboard.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const estimate=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='NewEstimate');
ok(Boolean(estimate),'Existing Create estimate form remains intact');
const body=estimate.getText(tree);
const picker=body.match(/<div className="estimate-service-picker">([\s\S]*?)<\/Select>\s*<\/div>/)?.[0];
ok(Boolean(picker),'Create estimate has a scoped ergonomic service picker');
const helper=body.match(/const selectEstimateService=\(index:number,value:string\)=>\{([\s\S]*?)\};/)?.[1];
ok(Boolean(helper),'Shortcut and full catalog share one service selection handler');
ok(helper.includes('const svc=services.find((entry)=>entry.id===value)'),
 'Shared handler selects the real current service catalog');
ok(helper.includes('unitRateCents:svc.rate||0'),
 'Shortcut cannot bypass catalog rates or invent a quote minimum');
ok(helper.includes('description:svc.description'),
 'Custom service retains editable description and scope');
ok(helper.includes('flatPriceCents:undefined'),
 'Service changes reset prior flat-price override instead of reusing old amount');
ok(helper.includes('quantity:["job","quantity","each"].includes(svc.unit)?1:0'),
 'Custom service retains ordinary quantity initialization');
ok(picker.includes('onClick={()=>selectEstimateService(index,"custom")}'),
 'Dedicated Custom Service shortcut selects the exact known catalog ID');
ok(picker.includes('onValueChange={(value)=>selectEstimateService(index,value)}'),
 'Full dropdown uses the SAME pricing handler');
ok(picker.includes('type="button" className="estimate-custom-service-shortcut"'),
 'Shortcut never submits a new estimate accidentally');
ok(picker.includes('disabled={!pricing.rates||pricing.loading||Boolean(pricing.error)||saving||uncertainSave}'),
 'Shortcut remains disabled while pricing is unavailable or save uncertain');
ok(picker.includes('position="popper" sideOffset={6}'),
 'Long Radix service dropdown may reposition away from bottom edge on phone');
ok(picker.includes('services.filter((svc)=>svc.id==="custom").map'),
 'Custom Service is the FIRST selectable dropdown option');
ok(picker.includes('services.filter((svc)=>svc.id!=="custom").map'),
 'All remaining existing catalog services are retained');
ok(picker.includes('Use Custom Service for service '),
 'Each shortcut identifies its estimate service line for VoiceOver');
ok(picker.includes('Choose service for line '),
 'Dropdown identifies the correct service line for VoiceOver');

const catalog=readFileSync('lib/fire-services.ts','utf8');
eq((catalog.match(/"id": "custom"/g)||[]).length,1,
 'Canonical service catalog has exactly one existing Custom Service');
ok(catalog.includes('"name": "Custom Service"'),
 'Owner-visible Custom Service name remains unchanged');
const css=readFileSync('app/globals.css','utf8');
ok(css.includes('.estimate-custom-service-shortcut{'),
 'The new shortcut has a dedicated style, not global button overrides');
ok(css.includes('min-height:46px;min-width:44px'),
 'Custom Service shortcut meets minimum touch-target dimensions');
ok(css.includes('.estimate-service-picker-trigger{width:100%;min-height:48px}'),
 'Main service picker is full width and at least 48px high');
ok(css.includes('.estimate-service-picker-menu .estimate-service-picker-option{'),
 'Only Create estimate service options receive enlarged touch targets');
ok(css.includes('min-height:48px;padding:11px 36px 11px 12px'),
 'All catalog choices have larger 48px tap targets');
ok(css.includes('padding-bottom:max(18px,env(safe-area-inset-bottom))'),
 'Last service has iPhone home-indicator safe-area clearance');
ok(css.includes('max-height:min(66dvh,var(--radix-select-content-available-height,66dvh))'),
 'Dropdown cannot extend below the mobile visible viewport');
ok(css.includes('.estimate-service-picker-label{'),
 'Shortcut is next to Service heading, not stuck to bottom of modal');

console.log('PASS '+checks+'/'+checks+' NEW iPhone Custom Service shortcut, 48px menu, safe-area and quote pricing invariants (source only).');
