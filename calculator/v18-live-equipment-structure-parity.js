(()=>{
  if(window.__fireV18EquipmentStructureParity)return;
  window.__fireV18EquipmentStructureParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const n=(id,d=0)=>{const e=$('#'+id),v=e?parseFloat(e.value):NaN;return Number.isFinite(v)?v:d};
  const inserts=[['Gray',2],['Purple',3],['Black',4],['Brown',5],['Yellow',6],['Green',8],['Blue',12],['White',20],['Red',23],['Beige',31],['None / open',35]];
  function firstCard(){return [...document.querySelectorAll('#equipment .card')].find(c=>c.querySelector('h2')?.textContent.trim()==='X-Jet M5DS Twist — 3–7 GPM')}
  function ensureStructure(){
    const card=firstCard(),measured=$('#xMeasuredPct');
    if(!card||!measured)return false;
    const grid=measured.closest('.grid');
    const field=measured.closest('.field');
    const legacyHeading=$('#xMeasuredCustomHeading',card);
    if(legacyHeading&&field&&!field.contains(legacyHeading)){
      legacyHeading.className='x-measured-heading';
      field.insertBefore(legacyHeading,field.firstChild);
    }
    const surface=$('#xSurface',card);
    if(surface)surface.className='formula';
    let guide=$('#xjetInsertGuide',card)||$('#xLiveGuidance',card);
    if(guide){guide.id='xjetInsertGuide';guide.className='callout good'}
    else if(surface){guide=document.createElement('div');guide.id='xjetInsertGuide';guide.className='callout good';surface.after(guide)}
    if(!guide)return false;
    let results=$('#xjetLiveResults',card);
    if(!results){results=document.createElement('div');results.id='xjetLiveResults';results.className='results';guide.after(results)}
    let note=$('#xjetModelNote',card);
    if(!note){note=document.createElement('div');note.id='xjetModelNote';note.className='callout info';results.after(note)}
    const factory=[...card.querySelectorAll('p')].find(p=>p.textContent.includes('Factory proportions are estimates'));
    if(factory&&factory.previousElementSibling!==note){factory.className='mini';note.after(factory)}
    else if(factory)factory.className='mini';
    if(grid)grid.dataset.liveStructure='1';
    return true;
  }
  function render(){
    const card=firstCard();if(!card||!ensureStructure())return false;
    const pct=Math.max(0,n('xMeasuredPct',35)),buck=Math.max(0,n('xBucket',10)),target=Math.max(0,n('xDesired',1));
    const strengths=inserts.map(([name,p])=>({name,p,str:buck*p/100}));
    let lower=strengths[0],upper=strengths[strengths.length-1];
    for(const x of strengths){if(x.str<=target)lower=x;if(x.str>=target){upper=x;break}}
    const chemOz=128*pct/100,waterOz=128-chemOz;
    const guide=$('#xjetInsertGuide',card),results=$('#xjetLiveResults',card),note=$('#xjetModelNote',card);
    if(guide)guide.textContent=`Your target is bracketed by ${lower.name} ≈ ${lower.str.toFixed(2)}% and ${upper.name} ≈ ${upper.str.toFixed(2)}%. Use the reverse recipe below for an exact bucket mix.`;
    if(results)results.innerHTML=`<div class="metric"><small>Pickup solution</small><strong>${chemOz.toFixed(1)} fl oz</strong><em>per gallon sprayed</em></div><div class="metric"><small>Pressure-washer water</small><strong>${waterOz.toFixed(1)} fl oz</strong><em>per gallon sprayed</em></div>`;
    if(note)note.innerHTML=`This matches your ${n('xGpm',4).toFixed(0)} GPM Simpson and the condition used for the factory proportioner estimates.<br><br>The manufacturer lists typical reach up to about 50 ft for the 3–7 GPM DS Twist.`;
    return true;
  }
  function install(){
    if(!ensureStructure())return false;
    const card=firstCard();
    if(card&&!card.dataset.xjetStructureBound){
      card.dataset.xjetStructureBound='1';
      ['xMeasuredPct','xBucket','xDesired','xGpm','xPct'].forEach(id=>$('#'+id)?.addEventListener('input',()=>queueMicrotask(render)));
    }
    render();
    return true;
  }
  let observer=null;
  const stopObserver=current=>{
    current?.disconnect();
    if(!current||observer===current)observer=null;
  };
  const start=()=>{
    if(install()){stopObserver(observer);return}
    if(observer)return;
    const current=new MutationObserver(()=>{if(install())stopObserver(current)});
    observer=current;
    const root=$('#equipment')||document.body;
    current.observe(root,{childList:true,subtree:true});
    setTimeout(()=>{if(install())stopObserver(current)},120);
    setTimeout(()=>{if(install())stopObserver(current)},900);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('fire-v18-core-ready',start);
  window.addEventListener('fire-v18-parity-loaded',start);
})();