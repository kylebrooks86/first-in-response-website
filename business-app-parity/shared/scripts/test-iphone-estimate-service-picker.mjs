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
const {estimateServicePickerOptions}=await import(
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
same(dashboard.split('estimateServicePickerOptions(services).map((svc)').length-1,3,
 'All three dropdowns display custom first without mutating full service catalog');
same(dashboard.split('className="estimate-service-picker-item"').length-1,3,
 'All three selectors get scoped tap target class');
check(dashboard.includes('value={item.serviceId} onValueChange='),
 'Existing controlled service selection retained, including ability to edit name/pricing');
check(dashboard.includes('updateItem(index,{serviceId:value,name:svc.name'),
 'Existing selection to configured service mapping untouched');
check(dashboard.includes('estimate-new-services-step space-y-5 px-6 py-6'),
 'New estimate service-and-save actions have mobile safe-area clearance');
check(dashboard.includes('Reuse copies the service and rate but leaves quantity blank.'),
 'Repetitive setup help shortened without hiding blank quantity requirement');
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
check(!helper.includes('fetch(')&&!helper.includes('localStorage'),
 'Picker is display-only, no network, writes, or persistence changes');
console.log('PASS '+checks+'/'+checks+' NEW service picker tap targets, Custom-first ordering and shorter estimate guidance checks.');
