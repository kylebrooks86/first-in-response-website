(()=>{
  if(window.__fireLiveBackupHandoff)return;window.__fireLiveBackupHandoff=true;
  const KEY='fireV18PendingLiveTakeover';
  const $=(s,r=document)=>r.querySelector(s);
  const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return null}};
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return{}}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const normUnit=u=>String(u||'').toLowerCase().replace(/\s+/g,'').includes('oz')?'floz':'gal';
  const toGal=(qty,unit)=>normUnit(unit)==='floz'?(+qty||0)/128:(+qty||0);
  const serviceMap={houseWashArea:'svcHouse',gutterFeet:'svcGutter',guardFeet:'svcGuard',brightenFeet:'svcBright',fenceArea:'svcFence',win1:'svcW1',win2:'svcW2',french1:'svcF1',french2:'svcF2',screen1:'svcS1',screen2:'svcS2',drivewayQty:'svcDrive',frontWalkQty:'svcFront',sideWalkQty:'svcSide',roofArea:'svcRoof',premiumFenceArea:'svcPremiumFence',deckArea:'svcDeck',paverArea:'svcPaver',masonryArea:'svcBrick',trashBinQty:'svcBins',dryerVentQty:'svcDryer',undergroundQty:'svcDown',frenchDrainQty:'svcFrenchDrain',acQty:'svcAC',rvQty:'svcRV',vehicleFeet:'svcVehicle',deepFrame1Qty:'svcFrame1',deepFrame2Qty:'svcFrame2',oxidationQty:'svcOx',cobwebQty:'svcCobweb'};
  const estimateMap={estimateJobName:'estimateJobName',manualAddOnLabel:'fullCustomDesc',manualAddOn:'fullCustomAmt',discountPct:'fullDiscount',quotedPrice:'fullOverride',estimateNotes:'fullNotes',laborHours:'laborHours',laborRate:'laborRate',otherCosts:'otherCosts'};
  const planningMap={jobArea:'area',coverage:'coverage',jobBatchSize:'planContainer',waste:'reserve',measureLength:'areaLen',measureHeight:'areaWid',measureSections:'areaSides',measureSubtract:'areaSubtract',calArea:'calArea',calMixUsed:'calMix'};
  const inventoryMap={sh:'sh',elemonator:'ele',gutterzap:'gutter',bioclean:'bio',odoban:'odo',f9porous:'f9',ettore:'ettore'};
  function validLive(data){return data?.format==='FIRE Field Calculator Backup'&&Number(data?.version)===3&&Number(data?.appVersion)===18&&data.data}
  function payloadFrom(data){
    if(!validLive(data))return null;
    const estimate=parse(data.data.fireEstimateDraft)||{};
    return {capturedAt:Date.now(),fields:estimate.fields||{},inventory:parse(data.data.fireInventory)||{},fieldCalc:parse(data.data.fireFieldCalc)||{},rig:parse(data.data.fireRig)||{},xjet:parse(data.data.fireXjet)||{}};
  }
  function persistCanonical(p){
    const fields=p.fields||{},parity=read('fireV18ParityDraft'),full=read('fireV18FullState'),planning=read('fireV18LivePlanningState');
    for(const [live,dr] of Object.entries(serviceMap)){if(fields[live]!==undefined){parity[dr]=String(fields[live]??'');full[dr]=String(fields[live]??'')}}
    for(const [live,dr] of Object.entries(estimateMap)){if(fields[live]!==undefined){parity[dr]=String(fields[live]??'');full[dr]=String(fields[live]??'')}}
    for(const [live,dr] of Object.entries(planningMap)){if(fields[live]!==undefined){planning[dr]=String(fields[live]??'');if(['areaLen','areaWid','areaSides','areaSubtract','calArea','calMix'].includes(dr))full[dr]=String(fields[live]??'')}}
    if(p.fieldCalc?.coverage!==undefined)planning.coverage=String(p.fieldCalc.coverage);
    write('fireV18ParityDraft',parity);write('fireV18FullState',full);write('fireV18LivePlanningState',planning);
    const specialty=read('fireV18SpecialtyInventory');
    for(const [live,dr] of Object.entries(inventoryMap)){const x=p.inventory?.[live];if(!x)continue;specialty[dr]={amount:+x.qty||0,unit:normUnit(x.unit)}}
    write('fireV18SpecialtyInventory',specialty);
    if(p.inventory?.sh)full.invSH=String(toGal(p.inventory.sh.qty,p.inventory.sh.unit));
    if(p.inventory?.elemonator)full.invEle=String(toGal(p.inventory.elemonator.qty,p.inventory.elemonator.unit));
    write('fireV18FullState',full);
  }
  function setDom(id,v){const e=$('#'+id);if(!e||v===undefined||v===null)return false;e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true}
  function hydrateDom(p){
    persistCanonical(p);
    const fields=p.fields||{};
    for(const [live,dr] of Object.entries(serviceMap))if(fields[live]!==undefined)setDom(dr,fields[live]);
    for(const [live,dr] of Object.entries(estimateMap))if(fields[live]!==undefined)setDom(dr,fields[live]);
    for(const [live,dr] of Object.entries(planningMap))if(fields[live]!==undefined)setDom(dr,fields[live]);
    if(p.fieldCalc){setDom('coverage',p.fieldCalc.coverage);setDom('stockStrength',p.fieldCalc.stock);setDom('shPrice',p.fieldCalc.shPrice);setDom('elePrice',p.fieldCalc.soapPrice);setDom('eleRate',p.fieldCalc.soapRate)}
    if(p.rig){setDom('pumpGpm',p.rig.rigGpm);setDom('propStock',p.rig.rigStock);setDom('propTarget',p.rig.rigTarget);setDom('soapPct',p.rig.rigSoapPct);setDom('waterTankSize',p.rig.rigWaterTank);setDom('shTankSize',p.rig.rigShTank);setDom('soapTankSize',p.rig.rigSoapTank)}
    if(p.xjet){setDom('xGpm',p.xjet.xjetGpm);setDom('xReverseStock',p.xjet.xjetStock);setDom('xDesired',p.xjet.xjetTarget);setDom('xBucketGal',p.xjet.xjetBucketSize);setDom('xMeasuredPct',p.xjet.xjetCustomPct);setDom('xDrawOz',p.xjet.xjetTestChemOz);setDom('xSecs',p.xjet.xjetTestSeconds)}
    const sh=p.inventory?.sh;if(sh){const row=document.querySelector('.fire-inv-row[data-inv-key="sh"]');if(row){const inp=row.querySelector('input'),sel=row.querySelector('select');if(inp){inp.value=String(+sh.qty||0);inp.dispatchEvent(new Event('input',{bubbles:true}))}if(sel){sel.value=normUnit(sh.unit);sel.dispatchEvent(new Event('change',{bubbles:true}))}}}
  }
  function verified(p){
    const f=p.fields||{},checks=[];
    if(f.estimateJobName!==undefined)checks.push(String($('#estimateJobName')?.value??'')===String(f.estimateJobName??''));
    if(f.houseWashArea!==undefined)checks.push(String($('#svcHouse')?.value??'')===String(f.houseWashArea??''));
    if(f.discountPct!==undefined)checks.push(String($('#fullDiscount')?.value??'')===String(f.discountPct??''));
    if(f.jobArea!==undefined)checks.push(String($('#area')?.value??'')===String(f.jobArea??''));
    const sh=p.inventory?.sh;if(sh){const inp=document.querySelector('.fire-inv-row[data-inv-key="sh"] input');if(inp)checks.push(Number(inp.value)===Number(sh.qty))}
    return checks.length>0&&checks.every(Boolean);
  }
  function applyPending(){let p;try{p=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}if(!p)return;hydrateDom(p);if(verified(p)){setTimeout(()=>{hydrateDom(p);if(verified(p)){localStorage.removeItem(KEY);localStorage.setItem('fireV18LiveTakeoverVerifiedAt',new Date().toISOString())}},250)}}
  document.addEventListener('change',async e=>{if(e.target?.id!=='importFile')return;const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text()),p=payloadFrom(data);if(p){localStorage.setItem(KEY,JSON.stringify(p));persistCanonical(p)}}catch{}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyPending,350));else setTimeout(applyPending,350);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(applyPending,80));
  window.addEventListener('fire-v18-shared-core-ready',()=>{setTimeout(applyPending,120);setTimeout(applyPending,700);setTimeout(applyPending,1500)});
  setTimeout(applyPending,2200);
})();