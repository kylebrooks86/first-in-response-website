(()=>{
  if(window.__fireLivePlanningState)return;window.__fireLivePlanningState=true;
  const KEY='fireV18LivePlanningState';
  const ids=['area','coverage','reserve','planContainer','areaLen','areaWid','areaSides','areaSubtract','calArea','calMix'];
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=o=>{try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}};
  let restoring=false,userGeneration=0;
  const save=()=>{const o=read();for(const id of ids){const e=document.getElementById(id);if(e)o[id]=e.value}write(o)};
  const restore=(generation=userGeneration)=>{if(generation!==userGeneration)return false;const o=read();restoring=true;try{for(const id of ids){const e=document.getElementById(id);if(e&&o[id]!==undefined&&o[id]!==null)e.value=String(o[id])}for(const id of ids){const e=document.getElementById(id);if(e){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}}finally{restoring=false}return true};
  const onUserEdit=e=>{if(restoring||window.__fireHydratingBackup===true)return;userGeneration++;const o=read();for(const id of ids){const el=document.getElementById(id);if(el)o[id]=el.value}if(e?.target?.id==='planContainer')o.planContainerManual=true;write(o)};
  const bind=()=>{for(const id of ids){const e=document.getElementById(id);if(e&&!e.dataset.firePlanningStateBound){e.dataset.firePlanningStateBound='1';e.addEventListener('input',onUserEdit);e.addEventListener('change',onUserEdit)}}};
  const apply=()=>{bind();const generation=userGeneration;restore(generation);setTimeout(()=>restore(generation),250);setTimeout(()=>restore(generation),900)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1250));else setTimeout(apply,1250);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,120));
  window.addEventListener('fire-v18-shared-core-ready',()=>{const generation=userGeneration;setTimeout(apply,120);setTimeout(()=>restore(generation),1000)});
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
})();