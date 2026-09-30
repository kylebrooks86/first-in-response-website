(()=>{
  if(window.__fireLivePlanningState)return;window.__fireLivePlanningState=true;
  const KEY='fireV18LivePlanningState';
  const ids=['area','coverage','reserve','planContainer'];
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=o=>{try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}};
  const save=()=>{const o=read();for(const id of ids){const e=document.getElementById(id);if(e)o[id]=e.value}write(o)};
  const restore=()=>{const o=read();for(const id of ids){const e=document.getElementById(id);if(e&&o[id]!==undefined&&o[id]!==null)e.value=String(o[id])}for(const id of ids){const e=document.getElementById(id);if(e){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}};
  const bind=()=>{for(const id of ids){const e=document.getElementById(id);if(e&&!e.dataset.firePlanningStateBound){e.dataset.firePlanningStateBound='1';e.addEventListener('input',save);e.addEventListener('change',save)}}};
  const apply=()=>{bind();restore()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1250));else setTimeout(apply,1250);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,120));
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
})();