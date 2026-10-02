(()=>{
  if(window.__fireV18LegacyJobDetached)return;
  window.__fireV18LegacyJobDetached=true;
  const legacy=window.calcJob;
  if(typeof legacy!=='function')return;
  ['area','coverage','reserve'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.removeEventListener('input',legacy);
  });
})();
