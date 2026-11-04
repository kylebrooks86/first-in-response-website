/** Read-only principal summary: unapproved quotes are potential work, not debt. */
export type BalanceEstimate={status:string;totalCents:number;depositCents:number;paidCents:number;invoiceId?:string|null;invoiceTotalCents?:number|null};
export function hasCollectibleJobValue(row:BalanceEstimate){
  // A revised invoice, including zero, remains authoritative.
  return ['approved','scheduled','completed'].includes(row.status)||Boolean(row.invoiceId)||row.invoiceTotalCents!==undefined&&row.invoiceTotalCents!==null;
}
export function summarizeCustomerBalances(rows:readonly BalanceEstimate[]){
  return rows.reduce((summary,row)=>{
    const balance=Math.max(0,(row.invoiceTotalCents??row.totalCents)-row.paidCents);
    summary.netPrincipalPaidCents+=row.paidCents;
    if(hasCollectibleJobValue(row)){
      summary.collectibleCents+=balance;if(balance>0)summary.collectibleJobs++;
      if(['approved','scheduled'].includes(row.status))summary.depositRemainingCents+=Math.min(balance,Math.max(0,row.depositCents-row.paidCents));
    }else if(['draft','sent'].includes(row.status)){
      summary.potentialCents+=balance;summary.potentialEstimates++;
    }
    return summary;
  },{collectibleCents:0,depositRemainingCents:0,potentialCents:0,netPrincipalPaidCents:0,collectibleJobs:0,potentialEstimates:0});
}
