import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source=fs.readFileSync(path.resolve('calculator/v18-live-backup-hydration.js'),'utf8');
const marker='fireV18LiveBackupMigratedAt';
const helper='fireV18ImportedLiveFieldCalc';
const cases=[
  {name:'successful finalization',expectPending:false,expectEvent:1},
  {name:'helper throws',helperThrows:true,expectPending:true,expectEvent:0},
  {name:'unapplied helper remains',pendingHelper:true,expectPending:true,expectEvent:0},
  {name:'marker removal fails',removeFails:true,expectPending:true,expectEvent:0},
  {name:'synthetic field event throws',fieldThrows:true,expectPending:true,expectEvent:0}
];

function runCase(test){
  const values=new Map([[marker,'2026-10-07T00:00:00Z']]);
  if(test.pendingHelper)values.set(helper,JSON.stringify({stock:10}));
  if(test.fieldThrows)values.set('fireEstimateDraft',JSON.stringify({fields:{houseWashArea:1200}}));
  const timers=[],events=[],listeners=new Map();
  const localStorage={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>{if(test.removeFails&&key===marker)throw Error('storage blocked');values.delete(key)}
  };
  const field={value:'',dispatchEvent:()=>{assert.equal(win.__fireHydratingBackup,true,'synthetic events must be guarded');if(test.fieldThrows)throw Error('event failed')}};
  const document={
    getElementById:id=>id==='svcHouse'?field:null,
    querySelector:()=>null
  };
  const win={
    addEventListener:(name,fn)=>listeners.set(name,fn),
    dispatchEvent:e=>{events.push(e.type)},
    __fireHydrateImportedLiveState:()=>{if(test.helperThrows)throw Error('helper failed')}
  };
  const context={
    window:win,document,localStorage,
    Event:class {constructor(type){this.type=type}},
    CustomEvent:class {constructor(type){this.type=type}},
    setTimeout:(fn,delay)=>timers.push({fn,delay}),
    Date,JSON,Object,String,Number,Array
  };
  vm.runInNewContext(source,context,{filename:'v18-live-backup-hydration.js'});
  assert.equal(timers.length,3);
  assert.equal(timers[2].delay,1800);
  if(test.fieldThrows)assert.throws(()=>timers[2].fn(),/event failed/);
  else timers[2].fn();
  assert.equal(values.has(marker),test.expectPending,test.name+' marker');
  assert.equal(events.filter(x=>x==='fire-backup-hydration-complete').length,test.expectEvent,test.name+' completion event');
  assert.notEqual(win.__fireHydratingBackup,true,test.name+' hydration guard released');
}
for(const test of cases)runCase(test);
console.log('BACKUP HYDRATION RUNTIME PASS scenarios='+cases.length);
