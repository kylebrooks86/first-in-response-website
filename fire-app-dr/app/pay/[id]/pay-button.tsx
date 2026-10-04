"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayButton({ shareToken, paymentType = "deposit", label }: { shareToken:string; paymentType?: "deposit" | "balance"; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const checkout = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shareToken, paymentType }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to open payment checkout.");
      window.location.href = result.url;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to open payment checkout."); setLoading(false); }
  };
  return <div><Button onClick={checkout} disabled={loading} className="brand-button h-12 w-full text-base">{loading ? <LoaderCircle className="animate-spin" /> : <CreditCard />} {loading ? "Opening secure checkout…" : (label || "Pay securely")}</Button>{error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}</div>;
}
