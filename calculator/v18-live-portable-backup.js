(()=>{
  if(window.__fireV18PortableBackup)return;window.__fireV18PortableBackup=true;
  const $=s=>document.querySelector(s);
  const val=(id,fallback='0')=>{const e=$('#'+id);return e?String(e.value??fallback):String(fallback)};
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const liveEstimateMap={
    estimateJobName:'estimateJobName',jobArea:'area',coverage:'coverage',waste:'reserve',jobBatchSize:'planContainer',
    houseWashArea:'svcHouse',gutterFeet:'svcGutter',guardFeet:'svcGuard',brightenFeet:'svcBright',fenceArea:'svcFence',
    win1:'svcW1',win2:'svcW2',french1:'svcF1',french2:'svcF2',screen1:'svcS1',screen2:'svcS2',
    deepFrame1Qty:'svcFrame1',deepFrame2Qty:'svcFrame2',oxidationQty:'svcOx',cobwebQty:'svcCobweb',
    drivewayQty:'svcDrive',frontWalkQty:'svcFront',sideWalkQty:'svcSide',roofArea:'svcRoof',premiumFenceArea:'svcPremiumFence',
    deckArea:'svcDeck',paverArea:'svcPaver',masonryArea:'svcBrick',trashBinQty:'svcBins',dryerVentQty:'svcDryer',
    undergroundQty:'svcDown',frenchDrainQty:'svcFrenchDrain',acQty:'svcAC',rvQty:'svcRV',vehicleFeet:'svcVehicle',
    manualAddOnLabel:'fullCustomDesc',manualAddOn:'fullCustomAmt',discountPct:'fullDiscount',quotedPrice:'fullOverride',estimateNotes:'fullNotes',
    laborHours:'laborHours',laborRate:'laborRate',otherCosts:'otherCosts',measureLength:'areaLen',measureHeight:'areaWid',
    measureSections:'areaSides',measureSubtract:'areaSubtract',calArea:'calArea',calMixUsed:'calMix'
  };
  const defaultField=(liveId)=>liveId==='estimateJobName'||liveId==='estimateNotes'?'':liveId==='manualAddOnLabel'?'Custom service':liveId==='jobArea'?'2000':liveId==='coverage'?'300':liveId==='waste'?'15':liveId==='jobBatchSize'?'4':liveId==='measureSections'?'1':'0';
  const estimateDraft=()=>{
    const prior=readJson('fireEstimateDraft',{}),fields={...(prior.fields||{})};
    for(const [liveId,drId] of Object.entries(liveEstimateMap))fields[liveId]=val(drId,fields[liveId]??defaultField(liveId));
    return {savedAt:Date.now(),fields};
  };
  const fieldCalc=()=>{
    const prior=readJson('fireFieldCalc',{}),active=$('#growthSeg .chip.active')?.dataset.growth||prior.growth||'medium';
    const growth=active==='moderate'?'medium':active;
    return {...prior,service:val('surface',prior.service||'house'),growth,target:val('targetNum',prior.target||'1'),soap:prior.soap!==false,stock:val('stockStrength',prior.stock||'10'),soapRate:val('eleRate',prior.soapRate||'1'),shPrice:val('shPrice',prior.shPrice||'4.50'),soapPrice:val('elePrice',prior.soapPrice||'45'),coverage:val('coverage',prior.coverage||'300')};
  };
  const rig=()=>{const prior=readJson('fireRig',{});return {...prior,rigGpm:val('pumpGpm',prior.rigGpm||'7'),rigStock:val('propStock',prior.rigStock||'10'),rigTarget:val('propTarget',prior.rigTarget||'1'),rigSoapPct:val('soapPct',prior.rigSoapPct||'0.5'),rigWaterTank:val('waterTankSize',prior.rigWaterTank||'75'),rigShTank:val('shTankSize',prior.rigShTank||'40'),rigSoapTank:val('soapTankSize',prior.rigSoapTank||'5')}};
  const xjet=()=>{const prior=readJson('fireXjet',{});return {...prior,xjetGpm:val('xGpm',prior.xjetGpm||'4'),xjetProportioner:val('xPct',prior.xjetProportioner||'35'),xjetBucketStrength:val('xBucket',prior.xjetBucketStrength||'10'),xjetCustomPct:val('xMeasuredPct',val('xPct',prior.xjetCustomPct||'35')),xjetTarget:val('xDesired',prior.xjetTarget||'1'),xjetStock:val('xReverseStock',val('stockStrength',prior.xjetStock||'10')),xjetBucketSize:val('xBucketGal',prior.xjetBucketSize||'5'),xjetTestSeconds:val('xSecs',prior.xjetTestSeconds||'30'),xjetTestChemOz:val('xDrawOz',prior.xjetTestChemOz||'64')}};
  const build=()=>{
    const data={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('fire'))data[k]=localStorage.getItem(k)}
    data.fireEstimateDraft=JSON.stringify(estimateDraft());
    data.fireFieldCalc=JSON.stringify(fieldCalc());
    data.fireRig=JSON.stringify(rig());
    data.fireXjet=JSON.stringify(xjet());
    return {format:'FIRE Field Calculator Backup',version:3,appVersion:18,exportedAt:new Date().toISOString(),data};
  };
  const text=()=>JSON.stringify(build(),null,2);
  const download=()=>{const blob=new Blob([text()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='FIRE_Field_Calculator_v18_Backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);const s=$('#backupStatus');if(s)s.textContent='Backup exported.';window.toast?.('Backup downloaded')};
  const copy=async()=>{try{await navigator.clipboard.writeText(text());window.toast?.('Backup text copied')}catch{window.toast?.('Copy unavailable')}};
  window.__fireBuildPortableBackupV3=build;
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#exportAll,#copyBackupText');if(!b)return;e.preventDefault();e.stopImmediatePropagation();b.id==='exportAll'?download():copy()},true);
})();
