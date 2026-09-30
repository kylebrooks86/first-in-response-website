(()=>{
if(window.__fireV18EquipmentParity)return;window.__fireV18EquipmentParity=true;
const $=(s,r=document)=>r.querySelector(s);
const STORE='fireV18EquipmentTankPlanner';
function n(id,d=0){const e=$('#'+id),v=e?parseFloat(e.value):NaN;return Number.isFinite(v)?v:d}
function loadSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return{}}}
function save(){const d={};['waterTankSize','shTankSize','soapTankSize'].forEach(id=>{const e=$('#'+id);if(e)d[id]=e.value});localStorage.setItem(STORE,JSON.stringify(d))}
function installXJetLiveParity(){
  const xPct=$('#xPct'),xBucket=$('#xBucket'),xSurface=$('#xSurface');
  if(xPct&&xBucket&&xSurface&&!$('#xMeasuredPct')){
    const field=document.createElement('div');field.className='field span4';
    field.innerHTML='<label>Measured chemical percentage</label><div class="inputrow"><input id="xMeasuredPct" type="number" min="0" max="100" step="0.1" value="'+(+xPct.value||35)+'"><span class="unit">%</span></div>';
    const grid=xBucket.closest('.grid');if(grid)grid.appendChild(field);
    const measured=$('#xMeasuredPct');
    const calc=()=>{const pct=Math.max(0,+measured.value||0),buck=Math.max(0,+xBucket.value||0);xSurface.textContent=(buck*pct/100).toFixed(2)+'% SH at the surface'};
    xPct.addEventListener('input',()=>{measured.value=xPct.value;calc()});
    xPct.addEventListener('change',()=>{measured.value=xPct.value;calc()});
    xBucket.addEventListener('input',calc);measured.addEventListener('input',calc);calc();
  }
  const draw=$('#xDrawOz');
  if(draw&&String(draw.value)==='32'){draw.value='64';draw.dispatchEvent(new Event('input',{bubbles:true}))}
}
function installTankPlanner(){
 const head=[...document.querySelectorAll('#equipment h2')].find(h=>h.textContent.trim()==='Three-port proportioner planner');
 if(!head)return;
 const card=head.closest('.card');if(!card||$('#waterTankSize'))return;
 const saved=loadSaved();
 const block=document.createElement('div');
 block.innerHTML=`<div class="grid" style="margin-top:16px">
   <div class="field span4"><label>Water tank size</label><div class="inputrow"><input id="waterTankSize" type="number" min="0" step="1" value="${saved.waterTankSize??55}"><span class="unit">gal</span></div></div>
   <div class="field span4"><label>SH tank size</label><div class="inputrow"><input id="shTankSize" type="number" min="0" step="1" value="${saved.shTankSize??35}"><span class="unit">gal</span></div></div>
   <div class="field span4"><label>Soap tank size</label><div class="inputrow"><input id="soapTankSize" type="number" min="0" step="1" value="${saved.soapTankSize??5}"><span class="unit">gal</span></div></div>
 </div>
 <div class="metrics" style="margin-top:12px">
   <div class="metric"><small>Continuous spray time</small><strong id="continuousSprayTime">—</strong><em id="limitingTank">limited by available tank volume</em></div>
   <div class="metric"><small>Total solution</small><strong id="totalSolutionAvailable">—</strong><em>before the first active tank runs dry</em></div>
 </div>`;
 card.appendChild(block);
 function calc(){
   const pump=Math.max(0,n('pumpGpm',7)),stock=Math.max(.1,n('propStock',10)),target=Math.max(0,n('propTarget',1)),soapPct=Math.max(0,n('soapPct',.5));
   const shPct=Math.max(0,target/stock*100),waterPct=Math.max(0,100-shPct-soapPct);
   const flows={Water:pump*waterPct/100,SH:pump*shPct/100,Soap:pump*soapPct/100};
   const tanks={Water:Math.max(0,n('waterTankSize',55)),SH:Math.max(0,n('shTankSize',35)),Soap:Math.max(0,n('soapTankSize',5))};
   const times=Object.entries(flows).filter(([,f])=>f>0).map(([name,f])=>({name,min:tanks[name]/f})).filter(x=>Number.isFinite(x.min));
   const limiting=times.length?times.reduce((a,b)=>b.min<a.min?b:a):null;
   const mins=limiting?Math.max(0,limiting.min):0,total=mins*pump;
   const t=$('#continuousSprayTime'),l=$('#limitingTank'),s=$('#totalSolutionAvailable');
   if(t)t.textContent=mins?`${mins.toFixed(1)} min`:'—';
   if(l)l.textContent=limiting?`${limiting.name} tank is the limiting tank`:'No active draw';
   if(s)s.textContent=mins?`${total.toFixed(1)} gal`:'—';
   save();
 }
 ['waterTankSize','shTankSize','soapTankSize','pumpGpm','propStock','propTarget','soapPct'].forEach(id=>$('#'+id)?.addEventListener('input',calc));
 calc();
}
function install(){installXJetLiveParity();installTankPlanner()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,800));else setTimeout(install,800);
window.addEventListener('fire-v18-core-ready',()=>setTimeout(install,50));
})();