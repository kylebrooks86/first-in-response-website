from pathlib import Path

path=Path('app/dashboard.tsx')
text=path.read_text()

pairs=[
('function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number)=>void}){','function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number,paidCents:number,billingExceptionOpen:boolean)=>void}){'),
('const result=await response.json() as {invoice?:{totalCents?:number};error?:string}','const result=await response.json() as {invoice?:{totalCents?:number};paidCents?:number;billingExceptionOpen?:boolean;error?:string}'),
('onSaved(Number(result.invoice.totalCents??total));setOpen(false);','onSaved(Number(result.invoice.totalCents??total),Number(result.paidCents??estimate.paidCents),Boolean(result.billingExceptionOpen));setOpen(false);'),
('<EditInvoiceDialog estimate={estimate} onSaved={(invoiceTotalCents)=>onChanged({...estimate,invoiceTotalCents})}/>','<EditInvoiceDialog estimate={estimate} onSaved={(invoiceTotalCents,paidCents,billingExceptionOpen)=>onChanged({...estimate,invoiceTotalCents,paidCents,paymentOverageOpen:billingExceptionOpen?1:0})}/>'),
]
for old,new in pairs:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('DR_INVOICE_EDIT_UI_APPLY=FAIL: expected source fragment not found')
    text=text.replace(old,new,1)
path.write_text(text)
print('DR_INVOICE_EDIT_UI_APPLY=PASS')
