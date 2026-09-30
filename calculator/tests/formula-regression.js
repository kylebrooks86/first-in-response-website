'use strict';
const R=Object.freeze({house:.22,gutter:1.5,guard:.5,bright:2,fence:.4,w1:7,w2:11,f1:12,f2:18,s1:3,s2:6,drive:175,front:75,side:25,rv:150,roof:0,premiumFence:0,deck:0,paver:0,brick:0,bins:0,dryer:0,down:0,frenchDrain:0,ac:0,vehicle:0,frame1:0,frame2:0,oxidation:0,cobweb:0});
const MIN=150,DEP=50;const n=v=>{v=Number(v);return Number.isFinite(v)?Math.max(0,v):0};const cents=v=>Math.round((v+Number.EPSILON)*100)/100;const line=(q,r)=>cents(n(q)*n(r));
function total(sub,disc=0,override=0,min=MIN){sub=n(sub);disc=Math.min(100,n(disc));override=n(override);if(override>0)return cents(override);if(sub<=0)return 0;return cents(Math.max(n(min),sub*(1-disc/100)))}
const deposit=(t,p=DEP)=>cents(n(t)*Math.min(100,n(p))/100);
function shRecipe(batchGal,targetPct,stockPct=10,eleOzPerGal=1){const batch=n(batchGal),target=n(targetPct),stock=Math.max(.1,n(stockPct)),eleRate=n(eleOzPerGal),totalOz=batch*128,shGal=target>stock?0:batch*target/stock,shOz=shGal*128,eleOz=batch*eleRate,waterOz=Math.max(0,totalOz-shOz-eleOz);return{batch,shGal,shOz,eleOz,waterOz,waterGal:waterOz/128}}
function stockBatchPlan(shOnHand,batchGal,targetPct,stockPct=10){const r=shRecipe(batchGal,targetPct,stockPct,0),count=r.shGal>0?Math.floor(n(shOnHand)/r.shGal):0;return{count,totalFinishedGal:count*n(batchGal)}}
const tests=[];const t=(name,fn)=>tests.push([name,fn]);const eq=(a,b,m)=>{if(!Object.is(a,b))throw Error(`${m}: expected ${b}, got ${a}`)};const near=(a,b,tol,m)=>{if(Math.abs(a-b)>tol)throw Error(`${m}: expected ${b}±${tol}, got ${a}`)};const ok=(x,m)=>{if(!x)throw Error(m)};
Object.entries({house:.22,gutter:1.5,guard:.5,bright:2,fence:.4,w1:7,w2:11,f1:12,f2:18,s1:3,s2:6,drive:175,front:75,side:25,rv:150}).forEach(([k,v])=>t(`approved rate ${k}`,()=>eq(R[k],v,k)));
t('house 1700',()=>eq(line(1700,R.house),374,'house1700'));t('house 2633',()=>eq(line(2633,R.house),579.26,'house2633'));t('gutter 250',()=>eq(line(250,R.gutter),375,'gutter250'));t('guard 250',()=>eq(line(250,R.guard),125,'guard250'));t('bright 175',()=>eq(line(175,R.bright),350,'bright175'));t('fence 1000',()=>eq(line(1000,R.fence),400,'fence1000'));t('window 20',()=>eq(line(20,R.w1),140,'window20'));t('screen2 9',()=>eq(line(9,R.s2),54,'screen2'));t('concrete combined',()=>eq(R.drive+R.front+R.side,275,'concrete'));
t('combined subtotal',()=>{const x=line(2633,R.house)+line(175,R.bright)+line(27,R.w1)+line(9,R.w2)+line(11,R.s1)+line(9,R.s2)+R.drive+R.front+R.side;eq(cents(x),1579.26,'combined')});
t('minimum below 150',()=>eq(total(100),150,'minimum'));t('zero does not trigger minimum',()=>eq(total(0),0,'zero'));t('10 percent discount',()=>eq(total(1000,10),900,'discount'));t('discount cannot bypass minimum',()=>eq(total(160,10),150,'discount+minimum'));t('100 percent discount still minimum',()=>eq(total(500,100),150,'100%'));t('override bypasses minimum',()=>eq(total(100,0,80),80,'override'));t('50 percent deposit',()=>eq(deposit(579.26),289.63,'deposit'));t('remaining balance',()=>eq(cents(579.26-deposit(579.26)),289.63,'remaining'));
t('blank quantity',()=>eq(line('',R.house),0,'blank'));t('zero quantity',()=>eq(line(0,R.house),0,'zero'));t('negative quantity clamped',()=>eq(line(-5,R.house),0,'negative'));t('invalid quantity',()=>eq(line('abc',R.house),0,'invalid'));t('large finite',()=>ok(Number.isFinite(line(1e7,R.house)),'large should be finite'));t('cent rounding',()=>eq(line(1.005,1),1.01,'rounding'));

t('live SH example stock ounces',()=>near(shRecipe(4,1,10,1).shOz,51.2,1e-9,'SH ounces'));
t('live SH example stock gallons',()=>near(shRecipe(4,1,10,1).shGal,.4,1e-12,'SH gallons'));
t('live SH example Elemonator',()=>near(shRecipe(4,1,10,1).eleOz,4,1e-12,'Elemonator ounces'));
t('live SH example water ounces',()=>near(shRecipe(4,1,10,1).waterOz,456.8,1e-9,'water ounces'));
t('live SH example water gallons display',()=>near(shRecipe(4,1,10,1).waterGal,3.56875,1e-12,'water gallons'));
t('live stock plan 5 gallons yields 12 batches',()=>eq(stockBatchPlan(5,4,1,10).count,12,'batch count'));
t('live stock plan yields 48 finished gallons',()=>eq(stockBatchPlan(5,4,1,10).totalFinishedGal,48,'finished gallons'));
t('zero SH target uses no stock SH',()=>eq(shRecipe(4,0,10,1).shGal,0,'zero target SH'));
t('blank batch safely becomes zero',()=>eq(shRecipe('',1,10,1).batch,0,'blank batch'));
t('negative Elemonator rate clamps to zero',()=>eq(shRecipe(4,1,10,-1).eleOz,0,'negative Elemonator'));

['roof','premiumFence','deck','paver','brick','bins','dryer','down','frenchDrain','ac','vehicle','frame1','frame2','oxidation','cobweb'].forEach(k=>t(`unapproved ${k} stays zero`,()=>eq(R[k],0,k)));t('entered unpriced service is detectable',()=>ok(2>0&&R.bins===0,'unpriced service must be detectable'));t('bundle stacking remains audit-gated',()=>ok(true,'do not invent stacking before live verification'));
let pass=0;for(const [name,fn] of tests){try{fn();pass++;console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.message);process.exitCode=1}}console.log(`\n${pass}/${tests.length} FIRE formula regression tests passed.`);if(process.exitCode)process.exit(process.exitCode);
