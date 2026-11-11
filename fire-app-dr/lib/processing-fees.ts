export type ProcessingAccounting = { processingFeeCents?: number | null; grossReceivedCents?: number | null; bundledTipCents?: number | null; processingMethod?: string | null; amountCents: number; type: string };
export function processingAmounts(invoiceCents: number, tipCents: number, fee: unknown, method: string) {
  const gross = invoiceCents + tipCents;
  if (!Number.isSafeInteger(invoiceCents) || invoiceCents < 0 || !Number.isSafeInteger(tipCents) || tipCents < 0 || !Number.isSafeInteger(gross)) throw new Error("Enter valid invoice and tip amounts.");
  const recorded = fee !== undefined && fee !== null && fee !== "";
  if (recorded && !["Cash App", "Venmo"].includes(method)) throw new Error("Manual processing fees are available only for Cash App and Venmo.");
  if (recorded && (typeof fee !== "number" || !Number.isSafeInteger(fee) || fee < 0 || fee > gross)) throw new Error("Processing fee must be between zero and the full customer payment.");
  return { grossReceivedCents: gross, processingFeeCents: recorded ? fee as number : null, bundledTipCents: tipCents, netReceivedCents: gross - (recorded ? fee as number : 0) };
}
export function summarizeProcessing(rows: ProcessingAccounting[], method?: string) {
  const included = rows.filter(row => row.processingMethod === method || (!row.processingMethod && row.type === method));
  const gross = included.reduce((sum,row)=>sum+(row.grossReceivedCents ?? row.amountCents),0);
  const fees = included.reduce((sum,row)=>sum+(row.processingFeeCents ?? 0),0);
  const tips = included.reduce((sum,row)=>sum+(row.type === "Tip" ? row.amountCents : row.bundledTipCents ?? 0),0);
  return { gross, fees, net: gross-fees, tips };
}
