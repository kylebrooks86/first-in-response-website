import {deriveCustomerManualFlags} from "./customer-activity-flags";
export type YardSignNoteRow={id:string;customerId:string;name:string;address:string|null;body:string;createdAt:string};
export type DashboardYardSign={customerId:string;customerName:string;pickupDate:string;location:string;placedAt:string};
export function outstandingYardSigns(rows:readonly YardSignNoteRow[]):DashboardYardSign[]{
 const grouped=new Map<string,YardSignNoteRow[]>();
 for(const row of rows){
   if(!row||typeof row.id!=="string"||typeof row.customerId!=="string"||!row.customerId||typeof row.name!=="string"||typeof row.body!=="string"||typeof row.createdAt!=="string")continue;
   const list=grouped.get(row.customerId)??[];
   list.push(row);grouped.set(row.customerId,list);
 }
 const results:DashboardYardSign[]=[];
 for(const [customerId,notes] of grouped){
   const flag=deriveCustomerManualFlags(notes);
   if(flag.sign?.state!=="out"||!flag.sign.pickupDate)continue;
   const latest=[...notes].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id))[0];
   results.push({customerId,customerName:latest.name,pickupDate:flag.sign.pickupDate,location:flag.sign.location||latest.address?.trim()||"Location not specified",placedAt:flag.sign.at});
 }
 return results.sort((a,b)=>a.pickupDate.localeCompare(b.pickupDate)||a.customerName.localeCompare(b.customerName)||a.customerId.localeCompare(b.customerId));
}
