import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const record=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='RecordPayment');
const due=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='amountDueNow'));
let cursor=0,state=[],pendingEffects=[],lastDeps,posts=[];
const stub=()=>null,Button=()=>null,Input=()=>null,Select=()=>null,Dialog=()=>null;
const exports={};
vm.runInNewContext(ts.transpileModule(due.getText(ast)+'\n'+record.getText(ast)+'\nexports.RecordPayment=RecordPayment;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useEffect(fn,deps){const key=JSON.stringify(deps);if(key!==lastDeps){lastDeps=key;pendingEffects.push(fn);}},
 Button,Input,Select,Dialog,DialogTrigger:stub,DialogContent:stub,DialogHeader:stub,DialogTitle:stub,Label:stub,SelectTrigger:stub,SelectValue:stub,SelectContent:stub,SelectItem:stub,CircleDollarSign:stub,DEFAULT_CASH_APP_HANDLE:'$FIREExteriors',DEFAULT_VENMO_HANDLE:'@FirstInResponseExteriors',money:c=>'$'+(c/100).toFixed(2),fetch:async(url,options)=>{posts.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({paidCents:20000})};},
});
const estimate={id:'synthetic',customer:'Synthetic QA',service:'Synthetic service',status:'completed',totalCents:10000,invoiceTotalCents:20000,depositCents:5000,paidCents:12000};
function nodes(tree){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;out.push(n);walk(n.props?.children);}walk(tree);return out;}
function render(overrides={}){cursor=0;let tree=exports.RecordPayment({estimate:{...estimate,...overrides}});const effects=pendingEffects;pendingEffects=[];effects.forEach(fn=>fn());if(effects.length){cursor=0;tree=exports.RecordPayment({estimate:{...estimate,...overrides}});}return tree;}
function preset(label,overrides={}){const choice=nodes(render(overrides)).find(n=>n.type==='button'&&nodes(n).some(c=>c.type==='strong'&&c.props.children===label));assert.ok(choice,'Missing manual tip choice: '+label);return choice;}
async function submit(overrides={}){nodes(render(overrides)).find(n=>n.type===Button&&n.props.className==='brand-button').props.onClick();for(let i=0;i<8;i++)await Promise.resolve();}
function open(overrides={}){nodes(render(overrides)).find(n=>n.type===Dialog).props.onOpenChange(true);return render(overrides);}
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
open();equal(preset('No tip').props['aria-pressed'],true);equal(nodes(render()).filter(n=>n.props?.['aria-label']==='Custom tip amount').length,0);
for(const label of ['No tip','5%','10%','15%','Custom']){assert.ok(preset(label));checks++;equal(preset(label).props.type,'button');}
for(const [label,tip] of [['5%',1000],['10%',2000],['15%',3000],['No tip',0]]){
 preset(label).props.onClick();equal(preset(label).props['aria-pressed'],true);await submit();equal(posts.at(-1).amountCents,8000);equal(posts.at(-1).tipCents,tip);equal(posts.at(-1).estimateId,'synthetic');open();equal(preset('No tip').props['aria-pressed'],true);
}
preset('Custom').props.onClick();nodes(render()).find(n=>n.props?.['aria-label']==='Custom tip amount').props.onChange({target:{value:'23.45'}});await submit();equal(posts.at(-1).tipCents,2345);equal(posts.at(-1).amountCents,8000);open();equal(preset('No tip').props['aria-pressed'],true);
for(const value of ['-1','201','501','NaN']){preset('Custom').props.onClick();nodes(render()).find(n=>n.props?.['aria-label']==='Custom tip amount').props.onChange({target:{value}});const count=posts.length;await submit();equal(posts.length,count);}
preset('5%').props.onClick();equal(nodes(render()).filter(n=>n.props?.['aria-label']==='Custom tip amount').length,0);
nodes(render()).find(n=>n.type===Select).props.onValueChange('Venmo');nodes(render()).find(n=>n.type===Input&&n.props.placeholder==='Not recorded'&&n.props.onChange).props.onChange({target:{value:'3.00'}});await submit();equal(posts.at(-1).tipCents,1000);equal(posts.at(-1).processingFeeCents,300);equal(posts.at(-1).amountCents,8000);
for(const status of ['approved','scheduled','draft','sent','declined'])equal(nodes(render({status})).filter(n=>n.props?.['aria-label']==='Optional tip choices').length,0);
equal(nodes(render({paidCents:20000})).filter(n=>n.props?.['aria-label']==='Optional tip choices').length,1);
const tipOnly={paidCents:20000};open(tipOnly);preset('5%',tipOnly).props.onClick();await submit(tipOnly);equal(posts.at(-1).amountCents,0);equal(posts.at(-1).tipCents,1000);equal(nodes(render(tipOnly)).find(n=>n.type===Dialog).props.open,false);
const fractional={invoiceTotalCents:10005,paidCents:0};open(fractional);preset('5%',fractional).props.onClick();await submit(fractional);equal(posts.at(-1).tipCents,500);
// Shared existing mobile selector styles apply to this manual selector too.
assert.ok(nodes(render()).some(n=>n.props?.className==='final-tip-options'));checks++;
console.log(`PASS ${checks}/${checks}: actual manual selector defaults, full revised invoice percentages, custom/invalid values, reopen reset, principal preservation, Venmo fee payload, completed-only visibility and tip-only availability. Mock request capture only; no processor or database writes.`);
