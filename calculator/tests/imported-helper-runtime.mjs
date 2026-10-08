import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src=fs.readFileSync(path.resolve('calculator/v18-interactions.js'),'utf8');
const start=src.indexOf('function hydrateImportedLiveState(');
const end=src.indexOf('window.__fireHydrateImportedLiveState=hydrateImportedLiveState;',start);
assert.ok(start>=0&&end>start,'portable helper function exists');
const fn=src.slice(start,end);

const tests=[
  {name:'growth-only',calc:{growth:'heavy'},growth:true,cleared:true},
  {name:'surface-only',calc:{service:'house'},surface:true,cleared:true},
  {name:'batch-only',calc:{batchPreset:'2',batch:2},batch:true,cleared:true},
  {name:'custom-batch-only',calc:{batchPreset:'custom',customBatch:3,customUnit:'gal'},batch:true,cleared:true},
  {name:'missing controls',calc:{growth:'heavy',service:'house',batchPreset:'2'},cleared:false},
  {name:'event throws',calc:{stock:10},stock:true,throws:true,cleared:false}
];

for(const test of tests){
  const marker='fireV18LiveBackupMigratedAt',key='fireV18ImportedLiveFieldCalc';
  const data=new Map([[marker,'pending'],[key,JSON.stringify(test.calc)]]);
  const storage={
    getItem:k=>data.get(k)??null,
    removeItem:k=>data.delete(k)
  };
  const event=()=>{assert.equal(win.__fireHydratingBackup,true,'restore events guarded');if(test.throws)throw Error('event failure')};
  const stock={value:'',dispatchEvent:event};
  const surface={value:'',options:[{value:'house'}],dispatchEvent:event};
  const batch={value:'',options:[{value:'1'},{value:'2'},{value:'custom'}],dispatchEvent:event};
  const custom={value:'',dispatchEvent:event};
  const growth={click:()=>{assert.equal(win.__fireHydratingBackup,true,'growth click guarded')}};
  const elements={
    '#stockStrength':test.stock?stock:null,
    '#surface':test.surface?surface:null,
    '#batchPreset':test.batch?batch:null,
    '#customBatch':test.batch?custom:null,
    '#customUnit':test.batch?custom:null,
    '#growthSeg [data-growth="heavy"]':test.growth?growth:null
  };
  const win={__fireHydratingBackup:false};
  const context={
    window:win,localStorage:storage,
    $:selector=>elements[selector]??null,
    safeParse:(k,fallback)=>{try{return JSON.parse(data.get(k))??fallback}catch{return fallback}},
    Event:class {constructor(type){this.type=type}},
    String,Number,Array,Math,parseFloat
  };
  vm.runInNewContext(fn,context);
  if(test.throws)assert.throws(()=>context.hydrateImportedLiveState(true),/event failure/);
  else context.hydrateImportedLiveState(true);
  assert.equal(data.has(key),!test.cleared,test.name+' helper retention');
  assert.equal(win.__fireHydratingBackup,false,test.name+' guard released');
}
console.log('IMPORTED HELPER RUNTIME PASS scenarios='+tests.length);
