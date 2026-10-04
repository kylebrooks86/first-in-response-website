(()=>{
  if(window.__fireV18LegacyJobDetached)return;
  window.__fireV18LegacyJobDetached=true;
  const legacy=window.calcJob;
  if(typeof legacy==='function'){
    ['area','coverage','reserve'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.removeEventListener('input',legacy);
    });
  }

  // full-v18-core still owns the arithmetic for the estimator, but its legacy
  // quote path expects #jobName. LIVE parity replaces that visible field with
  // #estimateJobName, so retain a non-visible compatibility sentinel rather
  // than allowing the old listener to throw on every parity refresh event.
  if(!document.getElementById('jobName')){
    const legacyJobName=document.createElement('input');
    legacyJobName.type='hidden';
    legacyJobName.id='jobName';
    legacyJobName.value='';
    legacyJobName.setAttribute('aria-hidden','true');
    document.body.appendChild(legacyJobName);
  }
})();
