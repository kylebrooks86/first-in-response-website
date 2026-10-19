/** Exercise the actual JobCost save handler and mobile Job Report/Cost UI, synthetic only. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require=createRequire(import.meta.url);
const source=readFileSync("app/dashboard.tsx","utf8"),css=readFileSync("app/globals.css","utf8");
const ast=ts.createSourceFile("dashboard.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="JobCost");
assert.ok(fn,"Actual JobCost function must exist");
const stateNames=[],tags=new Set();
function visit(n){
 if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==="useState")stateNames.push(n.name.elements[0].getText(ast));
 if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(ast);if(/^[A-Z]/.test(tag))tags.add(tag);}
 ts.forEachChild(n,visit);
}
visit(fn);
const text=fn.getText(ast).replace("  return <Dialog","  exports.add=add;\n  return <Dialog");
assert.notEqual(text,fn.getText(ast),"Save handler must be exposed for test");
const script=ts.transpileModule(text+"\nexports.component=JobCost;",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const wait=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function create(){
 const job={id:"synthetic-job",customerId:"synthetic-customer",totalCents:18001,service:"House wash"};
 const states=[],refs=[];let cursor=0,refCursor=0,effect=()=>{};
 const outgoing=[];
 let post=async()=>({ok:true,json:async()=>({expense:{id:"saved",estimateId:job.id,amountCents:123}})});
 let expenses=[];
 const handlers={
  exports:{},require,
  ...Object.fromEntries([...tags].map(tag=>[tag,()=>null])),
  money:c=>'$'+c,resolvedBillingTotalCents:e=>e.totalCents,
  navigator:{onLine:true},
  useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}]},
  useRef(initial){const i=refCursor++;return refs[i]??(refs[i]={current:initial});},
  useEffect(fn){effect=fn;},
  fetch:async(url,options)=>{
   if(url==="/api/expenses"&&options?.method==="POST"){
    outgoing.push(JSON.parse(options.body));return post();
   }
   eq(url,"/api/expenses","GET expense collection URL");
   return {ok:true,json:async()=>({expenses})};
  }
 };
 vm.runInNewContext(script,handlers);
 const render=()=>{cursor=0;refCursor=0;return handlers.exports.component({estimate:job});};
 const set=(key,value)=>{const index=stateNames.indexOf(key);assert.ok(index>=0,key);states[index]=value;render();};
 const get=key=>states[stateNames.indexOf(key)];
 const save=()=>{render();return handlers.exports.add();};
 const open=async()=>{render().props.onOpenChange(true);render();effect();await flush();};
 return {open,set,get,save,outgoing,setPost:fn=>post=fn,setExpenses:x=>expenses=x,render,handlers};
}
const f=create();
await f.open();
eq(f.get("loadError"),"","Initial job costs loaded");
for(const entry of ["bad","0","2.345","12.","-10","01.00"]){
 f.set("description","Chemicals");f.set("amount",entry);
 await f.save();eq(f.outgoing.length,0,entry+" must not create a record");
 eq(Boolean(f.get("saveError")),true,entry+" must show a visible validation message");
}
f.set("description","Chemical");f.set("amount","1.23");
f.setPost(async()=>({ok:false,json:async()=>({error:"The server refused this expense."})}));
await f.save();
eq(f.outgoing[0].amountCents,123,"Dollar-to-cents conversion is exact");
eq(f.get("saveError").includes("server refused"),true,"HTTP failure must be visible");
eq(f.get("description"),"Chemical","Failed entry must remain editable");
f.setPost(async()=>{throw Error("Network lost after sending request");});
await f.save();eq(f.get("saveError").includes("Refresh the list before attempting another entry"),true,"Unknown save must advise reconciliation");
f.setPost(async()=>({ok:true,json:async()=>({expense:{id:"bad",estimateId:"another-job",amountCents:123}})}));
await f.save();eq(f.get("saveError").includes("could not be confirmed"),true,"Wrong-job response cannot show success");
const pending=wait();let submissions=f.outgoing.length;
f.setPost(()=>pending.promise);const first=f.save();await flush();
const second=f.save();await second;
eq(f.outgoing.length,submissions+1,"Rapid repeated taps may only create one request");
f.render().props.onOpenChange(false);
eq(f.get("open"),true,"Dismissing costs while POST is pending must not orphan save state");
f.setExpenses([{id:"saved",estimateId:"synthetic-job",amountCents:123,description:"Chemical",category:"Supplies"}]);
pending.resolve({ok:true,json:async()=>({expense:{id:"saved",estimateId:"synthetic-job",amountCents:123}})});
await first;await flush();
eq(f.get("saveError"),"","Confirmed cost must clear errors");
eq(f.get("amount"),"","Confirmed cost clears amount");
eq(f.get("description"),"","Confirmed cost clears description");
eq(f.get("rows").length,1,"Confirmed cost refreshes job totals");
eq(f.get("saving"),false,"Cost entry unlocks after confirmed refresh");
f.render().props.onOpenChange(false);eq(f.get("open"),false,"Cost dialog closes after save settles");
const report=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="JobReport");
assert.ok(report);
for(const fragment of ['className="fire-job-dialog','className="report-progress"','role="status"','Save completed report','Save draft report','className="brand-button fire-job-save"']){assert.ok(report.getText(ast).includes(fragment),fragment);checks++;}
for(const fragment of ['.fire-job-dialog .cost-form','.fire-job-dialog .airflow-fields','.fire-job-dialog .report-progress','@media(max-width:360px)','min-height:44px']){assert.ok(css.includes(fragment),fragment);checks++;}
assert.ok(fn.getText(ast).includes('role="alert"'),"Job costs errors must be visible");checks++;
console.log("PASS "+checks+"/"+checks+": actual iPhone Job Cost entry validation, HTTP/network/response refusal, duplicate-tap lock, confirmed totals refresh, and responsive Job Report/Cost source UI. No hosted writes.");
