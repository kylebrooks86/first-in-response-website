"use client";

import {useEffect, useState, type FormEvent} from "react";

function safeReturnTo() {
 const value=new URLSearchParams(window.location.search).get("return_to")||"/";
 if(!value.startsWith("/")||value.startsWith("//"))return "/";
 try{
  const url=new URL(value,window.location.origin);
  return url.origin===window.location.origin?url.pathname+url.search+url.hash:"/";
 }catch{return "/";}
}

export default function LoginPage(){
 const [password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [mode,setMode]=useState<"loading"|"legacy"|"pin-or-passkey">("loading");
 useEffect(()=>{
  let active=true;
  fetch("/api/app-version",{cache:"no-store",credentials:"same-origin"})
   .then(r=>{if(!r.ok)throw Error("unavailable");return r.json();})
   .then((r:{quickAuthMode?:string})=>{if(active)setMode(r.quickAuthMode==="pin-or-passkey"?"pin-or-passkey":"legacy");})
   .catch(()=>{if(active)setMode("legacy");});
  return()=>{active=false;};
 },[]);
 const quick=mode==="pin-or-passkey",legacyNumeric=false;
 async function signIn(payload:{password?:string;method?:string;pin?:string}){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/auth/login",{method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"Sign-in denied.");
   window.location.assign(safeReturnTo());
  }catch(err){setError(err instanceof Error?err.message:"Sign-in unavailable.");setBusy(false);}
 }
 function submit(event:FormEvent){
  event.preventDefault();
  if(quick)void signIn({method:"pin",pin:password});
  else void signIn({password});
 }
 return <main className="access-page"><div className="access-card">
  <img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" />
  <h1>FIRE DR · private</h1>
  {mode==="loading"?<p>Checking secure sign-in…</p>:<>
   <p>{quick?"Choose your 4-digit PIN or use an enrolled Cloudflare Access passkey. Face ID / fingerprint prompts are controlled by your device.":"Use the independent DR passphrase until passkey/PIN setup is approved."}</p>
   {quick&&<button type="button" className="brand-button" disabled={busy}
    onClick={()=>void signIn({method:"passkey"})}>Continue after Face ID / fingerprint sign-in</button>}
   <form onSubmit={submit}>
    <label className="field-label" htmlFor="owner-password">{quick?"4-digit PIN":"DR owner passphrase"}</label>
    <input id="owner-password" type="password" autoComplete="off"
     inputMode={quick||legacyNumeric?"numeric":undefined}
     pattern={quick||legacyNumeric?"[0-9]{4}":undefined}
     minLength={quick||legacyNumeric?4:24} maxLength={quick||legacyNumeric?4:128}
     value={password} onChange={event=>setPassword(event.target.value)} required/>
    <button type="submit" className="brand-button" disabled={busy||(quick||legacyNumeric?!/^\d{4}$/.test(password):password.length<24)}>
     {busy?"Signing in…":quick?"Unlock with PIN":"Sign in"}
    </button>
   </form>
   {quick&&<p>Biometric sign-in must first be enabled for this app in Cloudflare Access. A PIN by itself cannot bypass verified owner identity.</p>}
  </>}
  {error&&<p className="save-error" role="alert">{error}</p>}
 </div></main>;
}
