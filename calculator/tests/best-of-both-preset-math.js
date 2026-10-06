'use strict';

const PRESETS=Object.freeze({
  house:{strengths:{light:.5,medium:1,heavy:1.5},ele:.3},
  wood:{strengths:{light:.5,medium:1,heavy:1.5},ele:.3},
  painted:{strengths:{light:.5,medium:.5,heavy:.5},ele:.3},
  concretePre:{strengths:{light:1,medium:2,heavy:3},ele:0},
  concretePost:{strengths:{light:.5,medium:1,heavy:1.5},ele:0},
  roof:{strengths:{light:3,medium:4,heavy:5},ele:1},
  brick:{strengths:{light:.5,medium:1,heavy:2},ele:.3},
  stucco:{strengths:{light:.5,medium:1,heavy:1.5},ele:.3},
  pavers:{strengths:{light:.5,medium:1,heavy:2},ele:.3}
});

const n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
function recipe(batch,target,stock,eleRate){
  batch=n(batch);target=n(target);stock=Math.max(.1,n(stock));eleRate=n(eleRate);
  if(target>stock)return {possible:false,requested:target,limited:stock};
  const sh=batch*target/stock;
  const eleOz=batch*eleRate;
  const water=Math.max(0,batch-sh-eleOz/128);
  return {possible:true,sh,eleOz,water};
}

const tests=[];const t=(name,fn)=>tests.push([name,fn]);
const eq=(a,b,m)=>{if(a!==b)throw Error(`${m}: expected ${b}, got ${a}`)};
const near=(a,b,tol,m)=>{if(Math.abs(a-b)>tol)throw Error(`${m}: expected ${b}±${tol}, got ${a}`)};
const ok=(x,m)=>{if(!x)throw Error(m)};

t('nine quick presets',()=>eq(Object.keys(PRESETS).length,9,'preset count'));
t('painted is fixed at 0.5',()=>{const s=PRESETS.painted.strengths;eq(s.light,.5,'painted light');eq(s.medium,.5,'painted medium');eq(s.heavy,.5,'painted heavy')});
t('roof profile 3 / 4 / 5',()=>{const s=PRESETS.roof.strengths;eq(s.light,3,'roof light');eq(s.medium,4,'roof medium');eq(s.heavy,5,'roof heavy')});
t('concrete pre profile 1 / 2 / 3',()=>{const s=PRESETS.concretePre.strengths;eq(s.light,1,'pre light');eq(s.medium,2,'pre medium');eq(s.heavy,3,'pre heavy')});
t('brick profile 0.5 / 1 / 2',()=>{const s=PRESETS.brick.strengths;eq(s.light,.5,'brick light');eq(s.medium,1,'brick medium');eq(s.heavy,2,'brick heavy')});
t('pavers profile 0.5 / 1 / 2',()=>{const s=PRESETS.pavers.strengths;eq(s.light,.5,'pavers light');eq(s.medium,1,'pavers medium');eq(s.heavy,2,'pavers heavy')});

t('4 gal medium house with 10 percent stock',()=>{
  const r=recipe(4,PRESETS.house.strengths.medium,10,PRESETS.house.ele);
  ok(r.possible,'house recipe should be possible');near(r.sh,.4,1e-12,'SH gal');near(r.eleOz,1.2,1e-12,'Ele oz');near(r.water,3.590625,1e-12,'water gal');
});
t('4 gal medium house with 12.5 percent stock',()=>{
  const r=recipe(4,PRESETS.house.strengths.medium,12.5,PRESETS.house.ele);
  ok(r.possible,'house 12.5 recipe should be possible');near(r.sh,.32,1e-12,'SH gal');near(r.water,3.670625,1e-12,'water gal');
});
t('4 gal heavy roof with 10 percent stock',()=>{
  const r=recipe(4,PRESETS.roof.strengths.heavy,10,PRESETS.roof.ele);
  ok(r.possible,'roof recipe should be possible');near(r.sh,2,1e-12,'SH gal');near(r.eleOz,4,1e-12,'Ele oz');near(r.water,1.96875,1e-12,'water gal');
});
t('4 gal concrete pre has no default Elemonator',()=>{
  const r=recipe(4,PRESETS.concretePre.strengths.medium,10,PRESETS.concretePre.ele);
  ok(r.possible,'concrete pre should be possible');eq(r.eleOz,0,'Ele oz');near(r.sh,.8,1e-12,'SH gal');near(r.water,3.2,1e-12,'water gal');
});
t('4 gal concrete post has no default Elemonator',()=>{
  const r=recipe(4,PRESETS.concretePost.strengths.medium,10,PRESETS.concretePost.ele);
  ok(r.possible,'concrete post should be possible');eq(r.eleOz,0,'Ele oz');near(r.sh,.4,1e-12,'SH gal');near(r.water,3.6,1e-12,'water gal');
});
t('5 percent roof target cannot be made from 4 percent stock',()=>{
  const r=recipe(4,PRESETS.roof.strengths.heavy,4,PRESETS.roof.ele);
  ok(!r.possible,'recipe should be blocked');eq(r.limited,4,'stock limit');
});
t('1 percent house target can be made from 1 percent stock',()=>{
  const r=recipe(4,1,1,.3);ok(r.possible,'equal target and stock should be allowed');near(r.sh,4,1e-12,'SH gal');
});

let pass=0;
for(const [name,fn] of tests){
  try{fn();pass++;console.log('PASS',name)}
  catch(e){console.error('FAIL',name,'\n ',e.message);process.exitCode=1}
}
console.log(`\n${pass}/${tests.length} best-of-both preset math tests passed.`);
if(process.exitCode)process.exit(process.exitCode);
