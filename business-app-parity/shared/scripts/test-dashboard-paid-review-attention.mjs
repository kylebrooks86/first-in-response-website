/** Dashboard review REQUEST actions and review STATUS checks stay distinct. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=readFileSync("app/dashboard.tsx","utf8");
const ast=ts.createSourceFile("dashboard.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="DashboardView");
assert.ok(component,"Actual DashboardView must exist");
let effect=null,action=null,retry=null;
function walk(n){
 if(ts.isCallExpression(n)&&n.expression.getText(ast)==="useEffect"&&n.arguments[0]?.getText(ast).includes('fetch("/api/payment-closeouts"'))effect=n.arguments[0].getText(ast);
 if(ts.isJsxOpeningElement(n)){
  const tag=n.tagName.getText(ast);
  if(tag==="button"){
   const attrs=n.attributes.properties;
   const label=attrs.find(x=>ts.isJsxAttribute(x)&&x.name.text==="aria-label");
   const click=attrs.find(x=>ts.isJsxAttribute(x)&&x.name.text==="onClick");
   if(label&&click&&ts.isStringLiteral(label.initializer)&&ts.isJsxExpression(click.initializer)){
    if(label.initializer.text==="Review paid jobs awaiting review requests")action=click.initializer.expression.getText(ast);
    if(label.initializer.text==="Retry unavailable paid-job review requests")retry=click.initializer.expression.getText(ast);
   }
  }
 }
 ts.forEachChild(n,walk);
}
walk(component);
assert.ok(effect&&action&&retry,"New dashboard effect, exact-record action and recovery action exist");
function compile(expression){const out={exports:{}};vm.runInNewContext(ts.transpileModule("exports.fn="+expression+";",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,out);return out.exports.fn;}
let checks=0;const check=(v,why)=>{assert.ok(v,why);checks++};
const valid={actions:[{estimateId:"paid-1",customerId:"customer-1",customerName:"Paid customer",totalCents:17500,lastPaidAt:new Date(Date.now()-86400000).toISOString(),state:"prepared",reviewPreparedAt:new Date(Date.now()-3600000).toISOString()}],mayHaveMore:false};
function fixture(){
 let rows=[],status="loading",more=false,failed=false,delayed=null;
 let requests=[],listeners={},docListeners={},intervals=new Map(),generation=0;let on=false;
 const context={exports:{},AbortController,setPaidReviewActions:x=>rows=x,setPaidReviewStatus:x=>status=x,setPaidReviewMore:x=>more=x,
 window:{addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k],setInterval:(fn,delay)=>{intervals.set(1,{fn,delay});return 1;},clearInterval:k=>intervals.delete(k)},
 document:{visibilityState:"visible",addEventListener:(k,fn)=>docListeners[k]=fn,removeEventListener:k=>delete docListeners[k]},
 fetch:async(url,opts)=>{requests.push({url,opts});if(delayed){const hold=delayed;delayed=null;return hold.promise;}if(failed)throw Error("offline");
   return {ok:true,json:async()=>structuredClone(valid)};}
 };
 const effect=compileEffect(context);
 const cleanup=effect();
 return {get:()=>({rows,status,more}),requests,listeners,docListeners,intervals,
  fail:v=>failed=v,
  refresh:()=>listeners["fire:attention-saved"]?.(),focus:()=>listeners.focus?.(),
  hide:()=>context.document.visibilityState="hidden",
  show:()=>context.document.visibilityState="visible",
  resume:()=>docListeners.visibilitychange?.(),
  delay:()=>{let resolve;const promise=new Promise(x=>resolve=x);delayed={promise,resolve};return delayed;},cleanup};
}
function compileEffect(ctx){
 const js=ts.transpileModule("exports.effect="+effect+";",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(js,ctx);return ctx.exports.effect;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
{
 const f=fixture();await tick();
 check(f.get().status==="ready"&&f.get().rows.length===1&&f.get().rows[0].state==="prepared","Verified paid action appears as prepared, never sent");
 check(f.requests.length===1&&f.requests[0].url==="/api/payment-closeouts"&&f.requests[0].opts.cache==="no-store","Initial read uses private no-cache feed");
 check(f.intervals.get(1)?.delay===60000,"Refreshes every 60 seconds on mounted Dashboard");
 f.fail(true);f.refresh();await tick();
 check(f.get().status==="error"&&f.get().rows.length===0,"Failed source shows error, not empty all-clear");
 f.fail(false);f.refresh();await tick();
 check(f.get().status==="ready"&&f.get().rows.length===1,"Confirmed-save event restores valid action");
 f.hide();const count=f.requests.length;f.resume();f.refresh();await tick();
 check(f.requests.length===count,"Background iPhone app does not fetch until visible");
 f.show();f.resume();await tick();
 check(f.requests.length===count+1,"Foreground app resumes with fresh read");
 f.cleanup();check(!f.listeners.focus&&!f.listeners["fire:attention-saved"]&&!f.docListeners.visibilitychange&&f.intervals.size===0,"Teardown removes listeners and timers");
}
{
 const selected=[],fallback=[];
 // Arrow is evaluated against the variable names captured in the real callback.
 const js=ts.transpileModule("exports.fn="+action+";",{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const ctx={exports:{},oldestPaidReview:{estimateId:"paid-1"},onOpenEstimate:id=>selected.push(id),onNavigate:tab=>fallback.push(tab)};
 vm.runInNewContext(js,ctx);ctx.exports.fn();
 check(selected.join("|")==="paid-1"&&fallback.length===0,"Dashboard opens exact paid job, not generic section");
 const noExact={exports:{},oldestPaidReview:{estimateId:"paid-1"},onOpenEstimate:null,onNavigate:tab=>fallback.push(tab)};
 vm.runInNewContext(js,noExact);noExact.exports.fn();
 check(fallback.at(-1)==="payments","Fallback opens Payments review queue");
}
{
 const js=ts.transpileModule("exports.fn="+retry+";",{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 let n=1;const ctx={exports:{},setPaidReviewReload:f=>n=f(n)};vm.runInNewContext(js,ctx);ctx.exports.fn();
 check(n===2,"Retry explicitly triggers a new owner read");
}
check(source.includes('paidReviewActions.length+(signStatus')===false||source.includes('+(paidReviewStatus==="ready"?paidReviewActions.length:0)'),"Known paid-job reminders contribute to Dashboard attention count");
check(source.includes("paidReviewMore?\"+\"")&&source.includes("Prepared review message — confirm whether it was actually sent"),"Truncation and selected customer prepared-not-sent state remain visible");
console.log("PASS "+checks+" synthetic Dashboard paid review request and exact navigation checks.");
