/**
 * Focused FIRE iPhone service picker regression contract (source-only).
 * No customer records, D1, R2, pricing writes or full QA rerun.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const helper=readFileSync('lib/estimate-service-picker-options.ts','utf8');
const js=ts.transpileModule(helper,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {estimateServicePickerOptions,estimateServicePickerGroups,ESTIMATE_SERVICE_VISUAL_GROUPS}=await import(
 'data:text/javascript;charset=utf-8,'+encodeURIComponent(js)
);
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++};
const same=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const fireSource=readFileSync('lib/fire-services.ts','utf8');
const catalogAst=ts.createSourceFile('fire-services.ts',fireSource,ts.ScriptTarget.Latest,true);
const declaration=catalogAst.statements.filter(ts.isVariableStatement)
 .flatMap(x=>x.declarationList.declarations)
 .find(x=>x.name.getText(catalogAst)==='FIRE_SERVICES');
check(declaration&&ts.isArrayLiteralExpression(declaration.initializer),'Real FIRE service catalog present');
const catalog=declaration.initializer.elements.map(item=>{
 check(ts.isObjectLiteralExpression(item),'Catalog contains structured services');
 const get=key=>{
  const member=item.properties.find(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText(catalogAst).replaceAll('"','')===key);
  return member?.initializer&&ts.isStringLiteral(member.initializer)?member.initializer.text:null;
 };
 return{id:get('id'),name:get('name'),original:item.getText(catalogAst)};
});
check(catalog.length>=45,'Actual detailed FIRE service catalog is retained');
check(catalog.at(-1).id==='custom','Previously last Custom Service in source catalog reproduced');
same(catalog.filter(x=>x.id==='custom').length,1,'Single Custom Service entry in catalog');
const ordered=estimateServicePickerOptions(catalog);
same(ordered.length,catalog.length,'Picker loses no service choices');
same(ordered[0].id,'custom','Custom Service now first on every estimate picker');
same(ordered.filter(x=>x.id==='custom').length,1,'Custom is shown exactly once');
same(ordered.slice(1).map(x=>x.id),catalog.filter(x=>x.id!=='custom').map(x=>x.id),
 'Every other standard service retains its original relative catalog order');
same(ordered.map(x=>x.original).sort(),catalog.map(x=>x.original).sort(),
 'Every original catalog service and its rate/description metadata is retained');
same(estimateServicePickerOptions([{id:'roof'},{id:'driveway'}]).map(x=>x.id),
 ['roof','driveway'],'Picker works when optional custom entry is absent');
same(estimateServicePickerOptions([]),[],'Empty catalog stays empty');
check(ordered[0]===catalog.at(-1),'Custom object identity and existing price properties unchanged');

const dashboard=readFileSync('app/dashboard.tsx','utf8');
const selectPart='<SelectContent className="estimate-service-picker" position="popper" sideOffset={6} collisionPadding={16}>';
same(dashboard.split(selectPart).length-1,3,
 'All 3 NewEstimate, EditEstimate, EditInvoice dropdowns receive collision-safe content');
same(dashboard.split('<CategorizedServiceOptions catalog={services}/>').length-1,3,
 'All three dropdowns use the same visual catalog grouping component');
const visualSource=readFileSync('components/visual-selection-options.tsx','utf8');
check(visualSource.includes('className="estimate-service-picker-item fire-visual-option"'),
 'All categorized service choices retain the existing 48px tap target');
check(visualSource.includes('textValue={service.name}'),'Service keyboard/typeahead uses original service name');
const visualGroups=estimateServicePickerGroups(catalog);
same(visualGroups[0].key,'custom','Custom remains visually first');
same(visualGroups.flatMap(group=>group.items).length,catalog.length,'No services lost in visual grouping');
same([...new Set(visualGroups.flatMap(group=>group.items.map(service=>service.id)))].length,catalog.length,'No repeated service choice in visual groups');
same(visualGroups.flatMap(group=>group.items.map(item=>item.id)).sort(),catalog.map(item=>item.id).sort(),'Service IDs and selection values remain identical');
check(visualGroups.some(group=>group.key==='drainage'&&group.items.some(item=>item.id==='gutters')),'Gutter family is clearly labeled');
check(visualGroups.some(group=>group.key==='glass'&&group.items.some(item=>item.id==='windows')),'Window family is clearly labeled');
check(ESTIMATE_SERVICE_VISUAL_GROUPS.length>=7,'Color categories cover the main services');
const unknown=estimateServicePickerGroups([{id:'new-owner-service',name:'New owner service'}]);
same(unknown[0].key,'other','Future services remain selectable in fallback group');
for(const kind of ['source','payment','expense'])check(visualSource.includes(' '+kind+':['),'Other long option sets reuse visual grouping without saving changes');

check(dashboard.includes('value={item.serviceId} onValueChange='),
 'Existing controlled service selection retained, including ability to edit name/pricing');
check(dashboard.includes('updateItem(index,{serviceId:value,name:svc.name'),
 'Existing selection to configured service mapping untouched');
check(dashboard.includes('estimate-new-services-step space-y-5 px-6 py-6'),
 'New estimate service-and-save actions have mobile safe-area clearance');
check(dashboard.includes('Reuse copies the service and rate, leaving quantity blank.'),
 'Service help stays available in one collapsed guide with blank quantity requirement');
check(dashboard.includes('Bundle discounts are separate and can stack.'),
 'Stacking discount terms preserved while trimming wording');
check(dashboard.includes('Combined percentage discounts are capped at 50%.'),
 'Appreciation and promotion combined cap still explained');

const select=readFileSync('components/ui/select.tsx','utf8');
check(select.includes('data-slot="select-viewport"'),
 'Stable Select viewport hook added without changing global component behavior');
const css=readFileSync('app/globals.css','utf8');
check(css.includes('.estimate-service-picker-item{')&&css.includes('min-height:48px'),
 'Picker options have at least 48px touch target height');
check(css.includes('.estimate-service-picker-trigger{width:100%;min-height:48px'),
 'Picker trigger is full-width and tall enough to tap');
check(css.includes('.estimate-service-picker [data-slot="select-viewport"]'),
 'Service-only popup viewport has explicit scroll and padding');
check(css.includes('scroll-padding-bottom:max(20px,env(safe-area-inset-bottom))'),
 'Last option can scroll up above iPhone safe-area boundary');
check(css.includes('.estimate-edit-modal-footer')&&css.includes('padding-bottom:max(12px,env(safe-area-inset-bottom))'),
 'Estimate editing save footer provides home-indicator clearance');
check(css.includes('.estimate-new-services-step')&&css.includes('padding-bottom:max(34px,calc(env(safe-area-inset-bottom) + 18px))'),
 'New estimate bottom actions are not flush against iPhone edge');
check(!helper.includes('fetch(')&&!helper.includes('localStorage')&&!visualSource.includes('fetch('),
 'Picker is display-only, no network, writes, or persistence changes');

const selectBase=readFileSync('components/ui/select.tsx','utf8');
check(selectBase.includes('position = "popper"')&&selectBase.includes('collisionPadding = 20'),
 'All shared selects use screen-edge collision handling, not the item-aligned bottom-clip mode');
check(selectBase.includes('sideOffset = 6'),
 'Shared select menus leave trigger clearance');
check(selectBase.includes('min-h-11 w-full cursor-default'),
 'Shared dropdown options have 44px minimum tap height');
const dropdownBase=readFileSync('components/ui/dropdown-menu.tsx','utf8');
check(dropdownBase.includes('collisionPadding = 20'),
 'Dropdown action menus also avoid screen edge');
check(dropdownBase.includes('min-h-11 cursor-default items-center'),
 'Dropdown action items have at least 44px targets');
const popoverBase=readFileSync('components/ui/popover.tsx','utf8');
check(popoverBase.includes('collisionPadding = 20'),
 'Notification and secondary popovers use screen-edge collision handling');
const sheetBase=readFileSync('components/ui/sheet.tsx','utf8');
check(sheetBase.includes('data-side={side}'),
 'Bottom sheets expose side for iPhone safe-area alignment');
check(css.includes('.estimate-service-picker[data-slot="select-content"]')&&
 css.includes('max-height:min(50dvh,'),
 'Long Custom Service list is no taller than half the mobile viewport');
check(css.includes('.estimate-service-picker [data-slot="select-viewport"]')&&
 css.includes('max-height:min(46dvh,'),
 'Inner service choices scroll inside a compact mobile menu');
check(css.includes('[data-slot="select-content"]')&&
 css.includes('[data-slot="dropdown-menu-content"]')&&
 css.includes('[data-slot="popover-content"]'),
 'All common modal menu families have independent max-height bounds');
check(css.includes('[data-slot="sheet-content"][data-side="bottom"]'),
 'Bottom action sheets never take the entire iPhone viewport');
check(css.includes('[data-slot="dialog-content"]:not(.estimate-edit-dialog)'),
 'Other long dialogs can scroll rather than lose their final action');
check(css.includes('min-width:44px;')&&css.includes('min-height:44px;'),
 'Mobile dialog close controls provide minimum usable touch area');


check(dashboard.split('>Scope &amp; description</Label>').length-1===3,
 'All estimate/new and invoice editing labels are short and consistent');
check(!dashboard.includes('Service description and expectations'),
 'Redundant long service description headings removed');
check(!dashboard.includes('rows={7}'),
 'Estimate editor no longer reserves seven lines per service');
check(dashboard.split('className="estimate-service-description" value={item.description}').length-1===3&&
 dashboard.includes('className="estimate-service-description" value={item.description}'),
 'New estimate, edit estimate, and invoice preserve the exact description with shared compact editing');
check(dashboard.includes('id={`invoice-${estimate.invoiceId}-${index}-description`} rows={3} className="estimate-service-description"'),
 'Final invoice scope field also uses compact three-line editor without losing saved text');
check(!dashboard.includes('Shown on the estimate and invoice.'),
 'Repeated per-service guidance removed from every quote line');
check(dashboard.includes('Descriptions appear on estimates and invoices.'),
 'Description visibility remains discoverable in single collapsed guide');
check(dashboard.split(' Add another service</Button>').length-1===3,
 'All three estimate/invoice editors retain their established tested Add another service action');
check(!dashboard.includes('Stacks with the promotion above.'),
 'No redundant stacking paragraph under each bundle discount input');
check(dashboard.includes('Bundle discounts are separate and can stack.'),
 'Owner explicitly retains promo plus dollar bundle stacking information');
check(dashboard.includes('Combined percentage discounts are capped at 50%.'),
 'Combined percent discount cap remains visible');
check(dashboard.includes('>Bundle discount ($)</Label>'),
 'Bundle discount label is concise and retains monetary unit');
check(dashboard.includes('>50% deposit to schedule<strong>')&&
 dashboard.includes('>50% deposit<strong>'),
 'Quote and edit-estimate retained owner 50% deposit summaries');
check(dashboard.includes('>Check interrupted save</h2>')&&
 dashboard.includes('Verify the last {taskRecoveryId?"task":"expense"} save before retrying to avoid duplicates.'),
 'Business recovery warning condensed without losing duplicate-save safeguard');
check(dashboard.includes('>Refresh alerts</Button>')&&dashboard.includes('>Refresh</Button>'),
 'Payment alert and review list actions remain but use short labels');
check(dashboard.includes('>Tax prep</summary>')&&dashboard.includes('>Tasks</h2>'),
 'Business navigation uses compact plain-language section labels');
check(dashboard.includes('Promotions are owner-applied. October 15% requires a qualifying booking'),
 'Promotional booking qualification and owner application warning retained');


check(css.includes('field-sizing:fixed;')&&css.includes('.estimate-edit-service .estimate-service-description{'),
 'Compact scope overrides shared field-sizing:content auto-growth');
check(css.includes('height:96px;')&&css.includes('overflow-y:auto;')&&css.includes('resize:vertical'),
 'Long description stays scrollable and manually expandable, not truncated');
check(css.includes('.estimate-edit-service .estimate-service-description:focus')&&
 css.includes('height:min(30dvh,180px)'),
 'Focused service descriptions expand for editing without consuming the entire mobile screen');

const editEstimateStart=dashboard.indexOf('function EditEstimateDialog(');
const editInvoiceStart=dashboard.indexOf('function EditInvoiceDialog(');
check(editEstimateStart>=0&&editInvoiceStart>editEstimateStart,
 'Both actual estimate and invoice editors remain present');
const actualEditEstimate=dashboard.slice(editEstimateStart,editInvoiceStart);
check(actualEditEstimate.includes('<strong>Service {index+1}</strong>{items.length>1&&<button'),
 'Edit Estimate never lets an owner remove its final service and leave an unsavable empty quote');
check(css.includes('.estimate-edit-service>header>button{display:grid;min-height:44px;min-width:44px;height:44px;width:44px;'),
 'Edit estimate and invoice delete controls are at least 44x44 touch targets');
check(css.includes('touch-action:manipulation;'),
 'Service action taps do not rely on tiny default icon hit areas');


/* Owner November 1: final-estimate action geometry and concise repeat work. */
check(dashboard.includes('className="estimate-new-save-actions flex gap-3"'),
 'New estimate has a scoped mobile footer for Back and Save');
check(dashboard.includes('onClick={()=>setStep(1)} disabled={saving||uncertainSave}'),
 'Back cannot interrupt an uncertain saved-estimate recovery');
check(dashboard.includes('aria-label="Choose service"')&&dashboard.includes('onClick={()=>void saveEstimate()}'),
 'Service selection and explicit estimate save actions remain available');
check(dashboard.includes('htmlFor={`estimate-service-description-${index}`}')&&
 dashboard.includes('id={`estimate-service-description-${index}`} rows={3}'),
 'New-estimate description label activates its matching editable field');
check(css.includes('.new-estimate-dialog .estimate-new-save-actions{')&&
 css.includes('grid-template-columns:minmax(72px,auto) minmax(0,1fr)'),
 'Narrow iPhones preserve room for both Back and Save controls');
check(css.includes('.new-estimate-dialog .estimate-new-save-actions>button{')&&
 css.includes('min-height:48px;')&&css.includes('white-space:normal;'),
 'Final-price Save text can wrap rather than clip and retains 48px tap target');
check(css.includes('[data-slot="select-trigger"]{')&&
 css.includes('min-height:44px;'),
 'All standard app and portalled dialog selects meet the minimum mobile tap target');
check(dashboard.includes('<span>{expanded?"Hide":"Details"}</span>')&&
 dashboard.includes('aria-label={`Review details for ${task.title}`}'),
 'Repeated task buttons have concise visible text and specific accessible names');
check(dashboard.includes('>Due date &amp; time (blank clears)</Label>')&&
 dashboard.includes('{rescheduleSaving?"Saving…":"Save date"}'),
 'Task rescheduling copy is compact and keeps clear-date semantics');
check(dashboard.includes('Customer notes and flags are unchanged.'),
 'Task rescheduling continues to explain that customer activity remains untouched');

console.log('PASS '+checks+'/'+checks+' NEW whole-app menu edge safety, Custom-first estimate choice, 44px tap targets and reduced wording checks.');
