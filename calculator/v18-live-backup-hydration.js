(()=>{
  if(window.__fireLiveBackupHydration)return;window.__fireLiveBackupHydration=true;
  const marker='fireV18LiveBackupMigratedAt',hydrated='fireV18LiveBackupHydratedAt';
  const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
  const map={
    estimateJobName:'estimateJobName',houseWashArea:'svcHouse',gutterFeet:'svcGutter',guardFeet:'svcGuard',brightenFeet:'svcBright',fenceArea:'svcFence',
    win1:'svcW1',win2:'svcW2',french1:'svcF1',french2:'svcF2',screen1:'svcS1',screen2:'svcS2',drivewayQty:'svcDrive',frontWalkQty:'svcFront',sideWalkQty:'svcSide',
    roofArea:'svcRoof',premiumFenceArea:'svcPremiumFence',deckArea:'svcDeck',paverArea:'svcPaver',masonryArea:'svcBrick',trashBinQty:'svcBins',dryerVentQty:'svcDryer',
    undergroundQty:'svcDown',frenchDrainQty:'svcFrenchDrain',acQty:'svcAC',rvQty:'svcRV',vehicleFeet:'svcVehicle',deepFrame1Qty:'svcFrame1',deepFrame2Qty:'svcFrame2',
    oxidationQty:'svcOx',cobwebQty:'svcCobweb',manualAddOnLabel:'fullCustomDesc',manualAddOn:'fullCustomAmt',discountPct:'fullDiscount',quotedPrice:'fullOverride',
    estimateNotes:'fullNotes',laborHours:'laborHours',laborRate:'laborRate',otherCosts:'otherCosts',jobArea:'area',coverage:'coverage',jobBatchSize:'planContainer',waste:'reserve',
    measureLength:'areaLen',measureHeight:'areaWid',measureSections:'areaSides',measureSubtract:'areaSubtract',calArea:'calArea',calMixUsed:'calMix'
  };
  const normUnit=u=>String(u||'').toLowerCase().replace(/\s+/g,'').includes('oz')?'floz':'gal';
  const emit=(id,value)=>{const e=document.getElementById(id);if(!e)return false;e.value=value==null?'':String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true};
  const pending=()=>!!localStorage.getItem(marker);
  function persistCustomerName(fields){
    if(!Object.prototype.hasOwnProperty.call(fields,'estimateJobName'))return;
    try{
      const draft=parse('fireV18ParityDraft')||{};
      draft.estimateJobName=String(fields.estimateJobName??'');
      localStorage.setItem('fireV18ParityDraft',JSON.stringify(draft));
    }catch{}
  }
  function hydrateInventory(){
    const inv=parse('fireInventory')||{},specialty=parse('fireV18SpecialtyInventory')||{};
    const defs={sh:'sh',elemonator:'ele',gutterzap:'gutter',bioclean:'bio',odoban:'odo',f9porous:'f9',ettore:'ettore'};
    let touched=false;
    for(const [live,dr] of Object.entries(defs)){const x=inv[live];if(!x)continue;specialty[dr]={amount:+x.qty||0,unit:normUnit(x.unit)};touched=true}
    if(touched)localStorage.setItem('fireV18SpecialtyInventory',JSON.stringify(specialty));
    const sh=inv.sh;if(sh){const row=document.querySelector('.fire-inv-row[data-inv-key="sh"]');if(row){const input=row.querySelector('input'),unit=row.querySelector('select');if(input){input.value=String(+sh.qty||0);input.dispatchEvent(new Event('input',{bubbles:true}))}if(unit){unit.value=normUnit(sh.unit);unit.dispatchEvent(new Event('change',{bubbles:true}))}}}
  }
  function hydrate(finalPass=false){
    if(!pending())return false;
    const raw=parse('fireEstimateDraft'),fields=raw?.fields;
    let applied=0;
    if(fields&&typeof fields==='object'){
      persistCustomerName(fields);
      for(const [live,dr] of Object.entries(map))if(Object.prototype.hasOwnProperty.call(fields,live)&&emit(dr,fields[live]))applied++;
      hydrateInventory();
      persistCustomerName(fields);
    }else hydrateInventory();
    if(finalPass&&localStorage.getItem(marker)){
      try{window.__fireHydrateImportedLiveState?.(true)}catch{}
      const pendingHelpers=['fireV18ImportedLiveFieldCalc','fireV18ImportedLiveRig','fireV18ImportedLiveXjet'].some(k=>{try{return localStorage.getItem(k)!==null&&Object.keys(parse(k)||{}).length>0}catch{return true}});
      if(!pendingHelpers){
        try{localStorage.setItem(hydrated,new Date().toISOString());localStorage.removeItem(marker)}catch{}
        window.dispatchEvent(new CustomEvent('fire-backup-hydration-complete'));
      }
    }
    return applied>0;
  }
  if(!pending())return;
  setTimeout(()=>hydrate(false),250);
  setTimeout(()=>hydrate(false),800);
  setTimeout(()=>hydrate(true),1800);
  window.addEventListener('fire-v18-shared-core-ready',()=>{setTimeout(()=>hydrate(false),50);setTimeout(()=>hydrate(false),700)});
})();
