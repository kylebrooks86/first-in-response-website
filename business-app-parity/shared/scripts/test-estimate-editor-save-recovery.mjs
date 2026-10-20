import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(r=>setImmediate(r));
let checks=0;function eq(a,b,label){assert.deepEqual(a,b,label);checks++;}
function nodes(tree){const result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;result.push(n);walk(n.props?.children);}walk(tree);return result;}
for(const name of ['EditEstimateDialog','EditInvoiceDialog']){
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name),names=[],tags=new Set();
 function visit(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')names.push(n.name.elements[0].getText(ast));if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const t=n.tagName.getText(ast);if(/^[A-Z]/.test(t))tags.add(t);}ts.forEachChild(n,visit);}visit(fn);
 const discount=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='discountMath');
 function fixture(){
  let state=[],cursor=0,refs=[],refCursor=0,fetcher;const requests=[],saved=[];
  const context={require,exports:{},services:[],serviceDescriptionFor:()=>'',money:v=>String(v),dateTime:v=>v,
   ...Object.fromEntries([...tags].map(t=>[t,()=>null])),useEffect(){},useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},fetch:(url,options)=>{requests.push({url,options});return fetcher(url,options);}};
  const code=readFileSync('lib/editable-line-totals.ts','utf8')+'\n'+discount.getText(ast)+'\n'+fn.getText(ast)+`\nexports.view=${name};`;
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  const estimate={id:'synthetic-job',invoiceId:'synthetic-invoice',service:'Wash',totalCents:20001,paidCents:5000,items:[]};
  const render=()=>{cursor=0;refCursor=0;return context.exports.view({estimate,onSaved:v=>saved.push(v)});};
  const set=(key,value)=>state[names.indexOf(key)]=value;
  render();set('open',true);set('items',[{id:'synthetic-line',name:'Wash',description:'Synthetic',quantity:3,unit:'job',unitRateCents:6667,preservedLineTotalCents:20001}]);
  return {render,set,requests,saved,setFetcher:f=>fetcher=f,get:key=>state[names.indexOf(key)],button:()=>nodes(render()).find(n=>n.type===context.Button&&[n.props.children].flat(Infinity).some(c=>typeof c==='string'&&c.startsWith('Save ')))};
 }
 for(const outcome of ['success','http','network','bad-json']){
  const f=fixture(),pending=deferred();f.setFetcher(()=>pending.promise);const button=f.button();
  button.props.onClick();button.props.onClick();eq(f.requests.length,1,name+' same-frame taps submit once');
  f.render().props.onOpenChange(false);eq(f.get('open'),true,'Pending edit cannot be dismissed');
  eq(nodes(f.render()).some(n=>n.type==='fieldset'&&n.props.disabled===true),true,'Pending form fields are disabled');
  const body=JSON.parse(f.requests[0].options.body);eq(body.items[0].totalCents,20001,'Original cents preserved');
  eq(f.requests[0].url,name==='EditInvoiceDialog'?'/api/invoices/synthetic-invoice':'/api/estimates/synthetic-job');
  if(outcome==='network')pending.reject(Error('Synthetic connection lost'));
  else if(outcome==='bad-json')pending.resolve({ok:true,json:async()=>{throw Error('Synthetic invalid response');}});
  else pending.resolve({ok:outcome==='success',json:async()=>outcome==='success'?(name==='EditInvoiceDialog'?{invoice:{totalCents:20001}}:{estimate:{id:'synthetic-job',totalCents:20001}}):{error:'Synthetic save failed'}});
  await flush();eq(f.get('saving'),false,'Save lock state recovers');
  if(outcome==='success'){eq(f.saved.length,1);eq(f.get('open'),false);}
  else {
   eq(f.saved.length,0);eq(f.get('open'),true);eq(Boolean(f.get('error')),true,'Failure remains visible');
   eq(nodes(f.render()).some(n=>n.type==='fieldset'&&n.props.disabled===false),true,'Inputs recover after failure');
   const retry=deferred();f.setFetcher(()=>retry.promise);f.button().props.onClick();eq(f.requests.length,2,'Retry releases synchronous guard');
   retry.resolve({ok:false,json:async()=>({error:'Synthetic retry failed'})});await flush();
   f.render().props.onOpenChange(false);eq(f.get('open'),false,'Failed edit can be closed safely');
  }
 }
}
console.log(`PASS ${checks}/${checks}: actual estimate and invoice editors reject duplicate taps, keep pending edits open, freeze fields, preserve cents, recover from HTTP/network/JSON failures, and retry.`);
