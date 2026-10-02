(()=>{
  if(window.__fireLiveInvalidBackupParity)return;window.__fireLiveInvalidBackupParity=true;
  const LIVE_ERROR='That is not a valid FIRE backup';
  const OLD_ERROR='That backup file could not be restored.';
  const normalize=()=>{const s=document.querySelector('#backupStatus');if(s&&s.textContent.trim()===OLD_ERROR)s.textContent=LIVE_ERROR};
  const install=()=>{const s=document.querySelector('#backupStatus');if(!s)return false;normalize();new MutationObserver(normalize).observe(s,{childList:true,characterData:true,subtree:true});return true};
  if(!install()){
    const o=new MutationObserver(()=>{if(install())o.disconnect()});
    o.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
