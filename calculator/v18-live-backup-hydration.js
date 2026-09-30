(()=>{
  if(window.__fireLiveBackupHydration)return;window.__fireLiveBackupHydration=true;
  const marker='fireV18LiveBackupMigratedAt';
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
  const emit=(id,value)=>{const e=document.getElementById(id);if(!e)return false;e.value=value==null?'':String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true};
  function hydrate(finalPass=false){
    if(!localStorage.getItem(marker))return false;
    const raw=parse('fireEstimateDraft'),fields=raw?.fields;if(!fields)return false;
    let applied=0;
    for(const [live,dr] of Object.entries(map))if(Object.prototype.hasOwnProperty.call(fields,live)&&emit(dr,fields[live]))applied++;
    if(applied&&finalPass){
      try{localStorage.setItem('fireV18LiveBackupHydratedAt',new Date().toISOString());localStorage.removeItem(marker)}catch{}
    }
    return applied>0;
  }
  if(!localStorage.getItem(marker))return;
  setTimeout(()=>hydrate(false),250);
  setTimeout(()=>hydrate(false),800);
  setTimeout(()=>hydrate(true),1800);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(()=>hydrate(false),50));
})();
