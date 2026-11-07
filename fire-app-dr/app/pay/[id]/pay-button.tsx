"use client";

import { useMemo, useState } from "react";
import { CreditCard, Heart, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const currency = (cents:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(cents/100);
const TIP_PRESETS = [0,5,10,15] as const;

export function PayButton({
  shareToken,
  paymentType = "deposit",
  label,
  dueAmountCents,
  tipBaseCents,
}: {
  shareToken:string;
  paymentType?: "deposit" | "balance";
  label?: string;
  dueAmountCents?: number;
  tipBaseCents?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tipChoice, setTipChoice] = useState<"0"|"5"|"10"|"15"|"custom">("0");
  const [customTip, setCustomTip] = useState("");

  const allowTip = paymentType === "balance" && Number.isSafeInteger(dueAmountCents) && Number(dueAmountCents) > 0 && Number.isSafeInteger(tipBaseCents) && Number(tipBaseCents) > 0;
  const tipCents = useMemo(() => {
    if (!allowTip) return 0;
    if (tipChoice === "custom") {
      const dollars = Number(customTip);
      if (!Number.isFinite(dollars) || dollars <= 0) return 0;
      return Math.max(0, Math.round(dollars * 100));
    }
    return Math.round(Number(tipBaseCents) * Number(tipChoice) / 100);
  }, [allowTip, customTip, tipBaseCents, tipChoice]);
  const totalCents = Number(dueAmountCents ?? 0) + tipCents;

  const checkout = async () => {
    setLoading(true); setError("");
    const maxTipCents = Math.min(Number(tipBaseCents ?? 0), 50000);
    if (tipCents > maxTipCents) {
      setError("Tip cannot exceed the invoice total or $500.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareToken, paymentType, tipCents: allowTip ? tipCents : 0 }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to open payment checkout.");
      window.location.href = result.url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open payment checkout.");
      setLoading(false);
    }
  };

  return <div className="space-y-3">
    {allowTip && <section className="rounded-xl border border-slate-700/70 bg-slate-950/20 p-3" aria-label="Optional tip">
      <div className="mb-2 flex items-center gap-2">
        <Heart className="h-4 w-4" />
        <div><strong className="block text-sm">Add an optional tip</strong><span className="text-xs text-muted-foreground">No tip is selected by default. Percentage tips are based on the full invoice total.</span></div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {TIP_PRESETS.map((percent)=><button
          key={percent}
          type="button"
          className={`rounded-lg border px-2 py-2 text-sm ${tipChoice===String(percent)?"border-red-500 bg-red-500/15 text-red-400":"border-slate-700"}`}
          onClick={()=>{setTipChoice(String(percent) as "0"|"5"|"10"|"15");setCustomTip("");}}
        >{percent===0?"No tip":`${percent}%`}</button>)}
        <button
          type="button"
          className={`rounded-lg border px-2 py-2 text-sm ${tipChoice==="custom"?"border-red-500 bg-red-500/15 text-red-400":"border-slate-700"}`}
          onClick={()=>setTipChoice("custom")}
        >Custom</button>
      </div>
      {tipChoice==="custom" && <div className="mt-2">
        <label className="text-xs text-muted-foreground" htmlFor="fire-custom-tip">Custom tip amount</label>
        <Input id="fire-custom-tip" inputMode="decimal" type="number" min="0" step="0.01" placeholder="$0.00" value={customTip} onChange={(event)=>setCustomTip(event.target.value)} />
      </div>}
      {tipCents>0 && <p className="mt-2 text-center text-sm">Tip: <strong>{currency(tipCents)}</strong> · Total card charge: <strong>{currency(totalCents)}</strong></p>}
    </section>}
    <Button onClick={checkout} disabled={loading} className="brand-button h-12 w-full text-base">
      {loading ? <LoaderCircle className="animate-spin" /> : <CreditCard />}
      {loading ? "Opening secure checkout…" : tipCents>0 ? `Pay ${currency(totalCents)} total securely` : (label || "Pay securely")}
    </Button>
    {error && <p className="text-center text-sm text-red-600">{error}</p>}
  </div>;
}
