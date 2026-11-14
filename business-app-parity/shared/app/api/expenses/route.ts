import { env } from "cloudflare:workers";
import {expenseBusinessDay,expenseDateInstant} from "../../../lib/expense-date";
import { getChatGPTUser } from "../../chatgpt-auth";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
async function authorized(){const user=await getChatGPTUser();return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);}

export async function GET(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
  const rows=await env.DB.prepare(`SELECT x.id,x.estimate_id AS estimateId,x.category,x.description,x.amount_cents AS amountCents,x.incurred_at AS incurredAt,x.created_at AS createdAt,c.name AS customer,
    COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'') AS service
    FROM expenses x LEFT JOIN estimates e ON e.id=x.estimate_id LEFT JOIN customers c ON c.id=e.customer_id ORDER BY x.incurred_at DESC,x.created_at DESC,x.id DESC`).all<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string;customer:string|null;service:string|null}>();
  const query=new URL(request.url).searchParams;
  if(query.get("format")==="csv"){
    const selectedYear=query.get("year");
    if(selectedYear!==null&&!/^(?:19|20)[0-9]{2}$/.test(selectedYear))return Response.json({error:"Choose a valid four-digit tax year."},{status:400});
    // A late December 31 owner expense can be January 1 in UTC.
    // Never group it under the wrong tax year or silently omit an invalid date.
    const datedRows=(rows.results??[]).map(item=>({item,day:expenseBusinessDay(item.incurredAt)}));
    if(datedRows.some(row=>!row.day))return Response.json(
      {error:"Saved expense dates could not be verified. Review the records before exporting."},
      {status:503,headers:{"cache-control":"private, no-store"}}
    );
    const exportRows=selectedYear?datedRows.filter(row=>row.day!.slice(0,4)===selectedYear):datedRows;
    // Excel and other spreadsheet tools can evaluate formula-looking CSV cells even when quoted.
    // Prefix text with an apostrophe when its first non-whitespace character is a formula operator.
    const escape=(value:unknown)=>{
      const original=String(value??"");
      const safe=/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(original)?"'"+original:original;
      return `"${safe.replaceAll('"','""')}"`;
    };
    const csv=["Date,Category,Description,Amount,Customer,Job",...exportRows.map(({item,day})=>[day,item.category,item.description,(item.amountCents/100).toFixed(2),item.customer,item.service].map(escape).join(","))].join("\n");
    return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename=${selectedYear?`fire-expenses-${selectedYear}-wave.csv`:"fire-expenses-wave.csv"}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }
  return Response.json({expenses:rows.results},{headers:{"cache-control":"private, no-store"}});
}

const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});
 let body:Record<string,unknown>;
 try{
  const parsed:unknown=await request.json();
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Invalid payload");
  body=parsed as Record<string,unknown>;
 }catch{return Response.json({error:"A valid expense request is required."},{status:400});}
 const description=String(body.description??"").trim();
 const rawAmount=body.amountCents;
 if((typeof rawAmount!=="number"&&typeof rawAmount!=="string")||(typeof rawAmount==="string"&&!rawAmount.trim())||!Number.isSafeInteger(Number(rawAmount))||Number(rawAmount)<=0||!description)
  return Response.json({error:"Description and a valid whole-cent amount are required."},{status:400});
 const amountCents=Number(rawAmount);
 if(body.requestId!==undefined&&(typeof body.requestId!=="string"||!v4.test(body.requestId)))return Response.json({error:"A valid expense request ID is required."},{status:400});
 const id=typeof body.requestId==="string"?body.requestId:crypto.randomUUID();
 const estimateId=String(body.estimateId??"").trim()||null;
 if(estimateId){
  const estimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=?").bind(estimateId).first<{id:string}>();
  if(!estimate)return Response.json({error:"Job not found. Refresh before attaching this expense."},{status:404});
 }
 // If no purchase date was supplied, the server chooses the timestamp only
 // for the FIRST write. Never compare a fresh "now" against a committed retry:
 // that would falsely report an idempotency conflict after a lost reply.
 const explicitDate=body.incurredAt!==undefined&&body.incurredAt!==null;
 const rawIncurredAt=String(explicitDate?body.incurredAt:new Date().toISOString());
 // Older/API clients can submit YYYY-MM-DD. JavaScript interprets that as
 // midnight UTC: Tulsa displays the previous day and could shift tax years.
 // Use the same noon UTC convention as the app's own date picker.
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(rawIncurredAt);
 const stableDate=dateOnly?expenseDateInstant(rawIncurredAt):null;
 // Refuse impossible rollover dates and timestamps without a timezone.
 if((dateOnly&&!stableDate)||(!dateOnly&&!expenseBusinessDay(rawIncurredAt)))
   return Response.json({error:"Choose a valid expense date with a verified business day."},{status:400});
 const parsedIncurredAt=new Date(stableDate??rawIncurredAt);
 if(!Number.isFinite(parsedIncurredAt.getTime()))return Response.json({error:"Choose a valid expense date."},{status:400});
 const category=String(body.category??"Supplies");
 const incurredAt=parsedIncurredAt.toISOString();
 const createdAt=new Date().toISOString();
 const privateHeaders={"cache-control":"private, no-store"};
 const uncertain=()=>Response.json({error:"Expense save could not be verified. Reopen saved expenses and keep the original request ID before trying again.",saveUncertain:true},
   {status:503,headers:privateHeaders});
 // A successful D1 acknowledgement is NOT proof of persistence. A thrown
 // acknowledgement also cannot prove the INSERT failed: read the original
 // immutable ID rather than issuing a second payment/expense write.
 let inserted:{success?:boolean;meta?:{changes?:number}}|null=null;
 try{
   inserted=await env.DB.prepare("INSERT OR IGNORE INTO expenses (id,estimate_id,category,description,amount_cents,incurred_at,created_at) VALUES (?,?,?,?,?,?,?)")
     .bind(id,estimateId,category,description,amountCents,incurredAt,createdAt).run();
 }catch{/* The database may already have committed the original operation. */}
 let saved:{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string}|null;
 try{
   saved=await env.DB.prepare("SELECT id,estimate_id AS estimateId,category,description,amount_cents AS amountCents,incurred_at AS incurredAt,created_at AS createdAt FROM expenses WHERE id=?")
     .bind(id).first<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string}>();
 }catch{return uncertain();}
 if(!saved)return uncertain();
 if(saved.id!==id||saved.estimateId!==estimateId||saved.category!==category||
    saved.description!==description||Number(saved.amountCents)!==amountCents||
    (explicitDate&&saved.incurredAt!==incurredAt)||
    !Number.isFinite(Date.parse(saved.incurredAt))||
    !Number.isFinite(Date.parse(saved.createdAt)))
   return Response.json({error:"That expense request ID is already associated with different details. Review saved expenses before trying again."},
     {status:409,headers:privateHeaders});
 // Only call it newly inserted when D1 confirms one row changed AND an
 // independent SELECT confirms the exact identity and request details.
 const newlyInserted=inserted?.success!==false&&inserted?.meta?.changes===1;
 return Response.json({expense:saved,requestId:id,confirmed:true},
   {status:newlyInserted?201:200,headers:privateHeaders});
}
