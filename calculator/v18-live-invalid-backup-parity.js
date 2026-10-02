(()=>{
  if(window.__fireLiveInvalidBackupParity)return;window.__fireLiveInvalidBackupParity=true;
  const LIVE_ERROR='That is not a valid FIRE backup';
  const OLD_ERROR='That backup file could not be restored.';
  const normalize=()=>{const s=document.querySelector('#backupStatus');if(s&&s.textContent.trim()===OLD_ERROR)s.textContent=LIVE_ERROR};
  document.addEventListener('change',e=>{if(e.target?.matches?.('#importFile,input[type="file"]'))setTimeout(normalize,0)},true);
})();
