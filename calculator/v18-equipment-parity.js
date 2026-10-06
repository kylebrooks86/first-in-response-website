(()=>{
if(window.__fireV18EquipmentParity)return;window.__fireV18EquipmentParity=true;
const $=(s,r=document)=>r.querySelector(s);
const STORE='fireV18EquipmentTankPlanner';
function n(id,d=0){const e=$('#'+id),v=e?parseFloat(e.value):NaN;return Number.isFinite(v)?v:d}
function loadSaved(){
  try{
    const d=JSON.parse(localStorage.getItem(STORE)||'{}')||{};
    const oldDefault=(String(d.waterTankSize??'55')==='55'&&String(d.shTankSize??'35')==='35'&&String(d.soapTankSize??'5')==='5');
    if(oldDefault){
      d.waterTankSize='75';d.shTankSize='40';d.soapTankSize='5';
      localStorage.setItem(STORE,JSON.stringify(d));
    }
    return d;
  }catch{return{}}
}
function save(){const d={};['waterTankSize','shTankSize','soapTankSize'].forEach(id=>{const e=$('#'+id);if(e)d[id]=e.value});localStorage.setItem(STORE,JSON.stringify(d))}
function round2(v){return (Math.round((v+Number.EPSILON)*100)/100).toFixed(2)}
function cardByHeading(text){return [...document.querySelectorAll('#equipment .card')].find(c=>c.querySelector('h2')?.textContent.trim()===text)}
function installXJetLiveParity(){
  const xPct=$('#xPct'),xBucket=$('#xBucket'),xSurface=$('#xSurface');
  if(xPct&&xBucket&&xSurface&&!$('#xMeasuredPct')){
    const field=document.createElement('div');field.className='field span4';
    field.innerHTML='<label>Measured chemical percentage</label><div class="inputrow"><input id="xMeasuredPct" type="number" min="0" max="100" step="0.1" value="'+(+xPct.value||35)+'"><span class="unit">%</span></div>';
    const grid=xBucket.closest('.grid');if(grid)grid.appendChild(field);
    const measured=$('#xMeasuredPct');
    try{const saved=localStorage.getItem('fireV18XjetMeasuredPct');if(saved!==null&&Number.isFinite(+saved))measured.value=String(+saved)}catch{}
    const calc=()=>{const pct=Math.max(0,+measured.value||0),buck=Math.max(0,+xBucket.value||0);xSurface.textContent=(buck*pct/100).toFixed(2)+'% SH at the surface'};
    const useFactory=()=>{measured.value=xPct.value;try{localStorage.setItem('fireV18XjetMeasuredPct',String(measured.value))}catch{};calc()};
    xPct.addEventListener('input',useFactory);
    xPct.addEventListener('change',useFactory);
    xBucket.addEventListener('input',calc);
    measured.addEventListener('input',()=>{try{localStorage.setItem('fireV18XjetMeasuredPct',String(measured.value))}catch{};calc();window.__fireCalcReverseX?.()});
    calc();
  }
  const draw=$('#xDrawOz');
  if(draw&&String(draw.value)==='32'){draw.value='64';draw.dispatchEvent(new Event('input',{bubbles:true}))}

  const first=cardByHeading('X-Jet M5DS Twist — 3–7 GPM');
  if(first){
    const measured=$('#xMeasuredPct'),bucket=$('#xBucket'),desired=$('#xDesired');
    if(measured&&!$('#xMeasuredCustomHeading',first)){
      const h=document.createElement('div');h.id='xMeasuredCustomHeading';h.className='muted';h.style.cssText='font-weight:700;margin:10px 0 6px';h.textContent='Measured custom draw';
      const field=measured.closest('.field');field?.parentElement?.insertBefore(h,field);
    }
    if(!$('#xLiveGuidance',first)){
      const box=document.createElement('div');box.id='xLiveGuidance';box.className='muted';box.style.marginTop='10px';
      const factory=[...first.querySelectorAll('p')].find(p=>p.textContent.includes('Factory proportions are estimates'));
      first.insertBefore(box,factory||null);
    }
    const inserts=[['Gray',2],['Purple',3],['Black',4],['Brown',5],['Yellow',6],['Green',8],['Blue',12],['White',20],['Red',23],['Beige',31],['None / open',35]];
    const renderGuidance=()=>{
      const pct=Math.max(0,n('xMeasuredPct',35)),buck=Math.max(0,n('xBucket',10)),target=Math.max(0,n('xDesired',1));
      const strengths=inserts.map(([name,p])=>({name,p,str:buck*p/100}));
      let lower=strengths[0],upper=strengths[strengths.length-1];
      for(const x of strengths){if(x.str<=target)lower=x;if(x.str>=target){upper=x;break}}
      const chemOz=128*pct/100,waterOz=128-chemOz;
      const box=$('#xLiveGuidance',first);if(!box)return;
      box.innerHTML=`<p>Your target is bracketed by ${lower.name} ≈ ${lower.str.toFixed(2)}% and ${upper.name} ≈ ${upper.str.toFixed(2)}%. Use the reverse recipe below for an exact bucket mix.</p><p><strong>Pickup solution</strong> ${chemOz.toFixed(1)} fl oz per gallon sprayed<br><strong>Pressure-washer water</strong> ${waterOz.toFixed(1)} fl oz per gallon sprayed</p><p>This matches your ${n('xGpm',4).toFixed(0)} GPM pressure washer and the condition used for the factory proportioner estimates.</p><p>The manufacturer lists typical reach up to about 50 ft for the 3–7 GPM DS Twist.</p>`;
    };
    ['xMeasuredPct','xBucket','xDesired','xGpm'].forEach(id=>$('#'+id)?.addEventListener('input',renderGuidance));renderGuidance();
  }

  const reverse=cardByHeading('Mix the X-Jet pickup bucket for a target strength');
  if(reverse){
    const req=$('#xReqBucket',reverse),reqMetric=req?.closest('.metric'),grid=reverse.querySelector('.grid');
    const metrics=reqMetric?.parentElement;
    const em=reqMetric?.querySelector('em');if(em)em.textContent='';
    if(reqMetric&&grid&&!reqMetric.dataset.liveReverseRequired){
      reqMetric.dataset.liveReverseRequired='1';
      reqMetric.classList.add('reverse-required');
      grid.appendChild(reqMetric);
    }
    if(metrics&&metrics!==grid){metrics.className='results x-reverse-results'}
    if(!$('#xReverseInstruction',reverse)){
      const p=document.createElement('div');p.id='xReverseInstruction';p.className='callout warn';p.textContent='Mix the pickup bucket first, verify the selected insert, then confirm the real draw with a timed bucket test.';
      const surf=[...reverse.querySelectorAll('p')].find(x=>x.textContent.includes('This recipe does not include surfactant volume'));
      reverse.insertBefore(p,surf||null);
    }else{$('#xReverseInstruction',reverse).className='callout warn'}
    const surf=[...reverse.querySelectorAll('p')].find(x=>x.textContent.includes('This recipe does not include surfactant volume'));
    if(surf)surf.className='mini';
  }

  const test=cardByHeading('X-Jet bucket draw test');
  if(test){
    [...test.querySelectorAll('em,small,p')].forEach(e=>{if(e.textContent.trim()==='using pickup strength')e.textContent='using bucket strength above'});
    if(!$('#useXjetMeasured',test)){
      const b=document.createElement('button');b.id='useXjetMeasured';b.type='button';b.className='primary';b.textContent='Use this measured draw';
      const actions=document.createElement('div');actions.className='actions';actions.appendChild(b);
      const instruction=[...test.querySelectorAll('p')].find(p=>p.textContent.includes('Start with a marked pickup bucket'));
      test.insertBefore(actions,instruction||null);
      b.addEventListener('click',()=>{
        const water=Math.max(0,n('xGpm',4))*Math.max(0,n('xSecs',30))/60;
        const chem=Math.max(0,n('xDrawOz',64))/128;
        const pct=(water+chem)>0?chem/(water+chem)*100:0;
        const measured=$('#xMeasuredPct');if(measured){measured.value=pct.toFixed(2);measured.dispatchEvent(new Event('input',{bubbles:true}));measured.dispatchEvent(new Event('change',{bubbles:true}))}
        try{localStorage.setItem('fireV18XjetMeasuredPct',String(pct))}catch{};window.__fireCalcReverseX?.()
      });
    }
  }

  const downstream=cardByHeading('Estimate strength hitting the surface');
  if(downstream&&!$('#dsFormulaNote',downstream)){
    const p=document.createElement('p');p.id='dsFormulaNote';p.className='muted';p.textContent='Formula: source strength ÷ (water parts + 1 chemical part). Injector specs are estimates—run a bucket draw test for your hose, tip, elevation, and machine.';downstream.appendChild(p)
  }
}
function installTankPlanner(){
 const head=[...document.querySelectorAll('#equipment h2')].find(h=>h.textContent.trim()==='Three-port proportioner planner');
 if(!head)return;
 const card=head.closest('.card');if(!card)return;
 if(!$('#waterTankSize')){
   const saved=loadSaved();
   const block=document.createElement('div');
   block.innerHTML=`<div class="grid" style="margin-top:16px">
     <div class="field span4"><label>Water tank</label><div class="inputrow"><input id="waterTankSize" type="number" min="0" step="1" value="${saved.waterTankSize??75}"><span class="unit">gal</span></div></div>
     <div class="field span4"><label>SH tank</label><div class="inputrow"><input id="shTankSize" type="number" min="0" step="1" value="${saved.shTankSize??40}"><span class="unit">gal</span></div></div>
     <div class="field span4"><label>Soap tank</label><div class="inputrow"><input id="soapTankSize" type="number" min="0" step="1" value="${saved.soapTankSize??5}"><span class="unit">gal</span></div></div>
   </div>
   <div class="metrics" style="margin-top:12px">
     <div class="metric"><small>Continuous spray time</small><strong id="continuousSprayTime">—</strong><em id="limitingTank">water tank limits run</em></div>
     <div class="metric"><small>Total solution available</small><strong id="totalSolutionAvailable">—</strong><em>at entered pump output</em></div>
   </div><p class="muted" id="propPlannerWarning">Planning target only: proportioner dial positions are not exact percentages. Calibrate each pickup line and verify the delivered mix. This is separate from both your X-Jet and downstream injector.</p>`;
   while(block.firstElementChild)card.appendChild(block.firstElementChild);
 }else{
   const fields=[['waterTankSize','Water tank'],['shTankSize','SH tank'],['soapTankSize','Soap tank']];fields.forEach(([id,text])=>{const l=$('#'+id)?.closest('.field')?.querySelector('label');if(l)l.textContent=text});
   const m=$('#totalSolutionAvailable')?.closest('.metric');if(m){const s=m.querySelector('small');if(s)s.textContent='Total solution available';const e=m.querySelector('em');if(e)e.textContent='at entered pump output'}
   if(!$('#propPlannerWarning',card)){const p=document.createElement('div');p.id='propPlannerWarning';p.className='callout warn';p.textContent='Planning target only: proportioner dial positions are not exact percentages. Calibrate each pickup line and verify the delivered mix. This is separate from both your X-Jet and downstream injector.';card.appendChild(p)}
 }
 const tankGrid=$('#waterTankSize',card)?.closest('.grid');
 const tankResults=$('#continuousSprayTime',card)?.closest('.metrics, .results');
 const warning=$('#propPlannerWarning',card);
 const wrapper=tankGrid?.parentElement;
 if(wrapper&&wrapper!==card&&!wrapper.classList.contains('card')){
   if(tankGrid)card.insertBefore(tankGrid,wrapper);
   if(tankResults)card.insertBefore(tankResults,wrapper);
   if(warning)card.insertBefore(warning,wrapper);
   wrapper.remove();
 }
 const valveMetrics=[...card.querySelectorAll('.metrics')].find(m=>m.querySelector('small')?.textContent.includes('Water valve target'));
 if(valveMetrics)valveMetrics.className='results prop-valve-results';
 const liveTankResults=$('#continuousSprayTime',card)?.closest('.metrics, .results');
 if(liveTankResults)liveTankResults.className='results prop-tank-results';
 if(tankGrid){tankGrid.classList.add('prop-tank-grid');tankGrid.style.marginTop='12px'}
 if(warning)warning.className='callout warn';
 function calc(){
   const pump=Math.max(0,n('pumpGpm',7)),stock=Math.max(.1,n('propStock',10)),target=Math.max(0,n('propTarget',1)),soapPct=Math.max(0,n('soapPct',.5));
   const shPct=Math.max(0,target/stock*100),waterPct=Math.max(0,100-shPct-soapPct);
   const flows={Water:pump*waterPct/100,SH:pump*shPct/100,Soap:pump*soapPct/100};
   const tanks={Water:Math.max(0,n('waterTankSize',75)),SH:Math.max(0,n('shTankSize',40)),Soap:Math.max(0,n('soapTankSize',5))};
   const times=Object.entries(flows).filter(([,f])=>f>0).map(([name,f])=>({name,min:tanks[name]/f})).filter(x=>Number.isFinite(x.min));
   const limiting=times.length?times.reduce((a,b)=>b.min<a.min?b:a):null;
   const mins=limiting?Math.max(0,limiting.min):0,total=mins*pump;
   const t=$('#continuousSprayTime'),l=$('#limitingTank'),s=$('#totalSolutionAvailable');
   if(t)t.textContent=mins?`${mins.toFixed(1)} min`:'—';
   if(l)l.textContent=limiting?`${limiting.name.toLowerCase()} tank limits run`:'No active draw';
   if(s)s.textContent=mins?`${total.toFixed(1)} gal`:'—';
   const waterMetric=[...card.querySelectorAll('.metric')].find(x=>x.querySelector('small')?.textContent.trim()==='Water valve target');
   const waterStrong=waterMetric?.querySelector('strong'),waterEm=waterMetric?.querySelector('em');if(waterStrong)waterStrong.textContent=waterPct.toFixed(1)+'%';if(waterEm)waterEm.textContent=round2(flows.Water)+' GPM';
   save();
 }
 ['waterTankSize','shTankSize','soapTankSize','pumpGpm','propStock','propTarget','soapPct'].forEach(id=>$('#'+id)?.addEventListener('input',calc));
 calc();
}
function install(){installXJetLiveParity();installTankPlanner()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,800));else setTimeout(install,800);
window.addEventListener('fire-v18-core-ready',()=>setTimeout(install,50));
})();