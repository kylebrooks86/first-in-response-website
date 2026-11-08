"use client";

import { type FormEvent, useState } from "react";

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("return_to") || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");
      window.location.assign(safeReturnTo());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="access-page"><form className="access-card" onSubmit={submit}><img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" /><h1>FIRE synthetic QA · private</h1><p>Use the independent synthetic QA passphrase. Never enter the LIVE or Doomsday PIN. No real customer records or payments belong here.</p><label className="field-label" htmlFor="owner-password">QA test passphrase</label><input id="owner-password" type="password" minLength={24} maxLength={128} autoComplete="off" value={password} onChange={(event)=>setPassword(event.target.value)} required /><button className="brand-button" type="submit" disabled={busy||password.length < 24}>{busy?"Signing in…":"Sign in"}</button>{error&&<p className="save-error" role="alert">{error}</p>}</form></main>;
}
