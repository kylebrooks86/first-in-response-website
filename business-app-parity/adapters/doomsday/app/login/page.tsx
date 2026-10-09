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

  return <main className="access-page"><form className="access-card" onSubmit={submit}><img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" /><h1>Private FIRE app</h1><p>Enter your 4-digit PIN to access business records.</p><label className="field-label" htmlFor="owner-password">4-digit PIN</label><input id="owner-password" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={password} onChange={(event)=>setPassword(event.target.value)} required /><button className="brand-button" type="submit" disabled={busy||!/^\d{4}$/.test(password)}>{busy?"Signing in…":"Sign in"}</button>{error&&<p className="save-error" role="alert">{error}</p>}</form></main>;
}
