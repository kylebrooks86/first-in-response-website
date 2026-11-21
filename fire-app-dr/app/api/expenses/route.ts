import { env } from "cloudflare:workers";
import { getOwnerUser } from "../../owner-auth";
import {expenseBusinessDay} from "../../../lib/expense-date";
const OWNER_EMAIL="kylebrooks8605@gmail.com";
const privateExpenseGetHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
async function authorized(){
 try{
  const user=await getOwnerUser();
  return Boolean(user&&typeof user.email==='string'&&user.email.toLowerCase()===OWNER_EMAIL);
 }catch{
  // Failed owner-session resolution or unreadable email is private 401, not a 500.
  // GET export and POST receipt both deny before any financial D1 activity.
  return false;
 }
}

export async function GET(request:Request){
  if(!await authorized())return Response.json({error:"Unauthorized"},{status:401,headers:privateExpenseGetHeaders});
  const query=new URL(request.url).searchParams;
  const isCsv=query.get("format")==="csv";
  const selectedYear=isCsv?query.get("year"):null;
  // Refuse malformed CSV requests before any private D1 read or expensive export.
  if(isCsv&&selectedYear!==null&&!/^(?:19|20)[0-9]{2}$/.test(selectedYear))
    return Response.json({error:"Choose a valid four-digit tax year."},{status:400,headers:privateExpenseGetHeaders});
  try{
  const rows=await env.DB.prepare(`SELECT x.id,x.estimate_id AS estimateId,x.category,x.description,x.amount_cents AS amountCents,x.incurred_at AS incurredAt,x.created_at AS createdAt,c.name AS customer,
    COALESCE((SELECT GROUP_CONCAT(name, ', ') FROM estimate_items ei WHERE ei.estimate_id=e.id),'') AS service
    FROM expenses x LEFT JOIN estimates e ON e.id=x.estimate_id LEFT JOIN customers c ON c.id=e.customer_id ORDER BY x.incurred_at DESC,x.created_at DESC,x.id DESC`).all<{id:string;estimateId:string|null;category:string;description:string;amountCents:number;incurredAt:string;createdAt:string;customer:string|null;service:string|null}>();
    if(isCsv){
    // A late December 31 owner expense can be January 1 in UTC.
    // Never group it under the wrong tax year or silently omit an invalid date.
    const datedRows=(rows.results??[]).map(item=>({item,day:expenseBusinessDay(item.incurredAt)}));
    if(datedRows.some(row=>!row.day))return Response.json(
      {error:"Saved expense dates could not be verified. Review the records before exporting."},
      {status:503,headers:privateExpenseGetHeaders}
    );
    const exportRows=selectedYear?datedRows.filter(row=>row.day!.slice(0,4)===selectedYear):datedRows;
    // Excel and other spreadsheet tools can evaluate formula-looking CSV cells even when quoted.
    // Prefix text with an apostrophe when its first non-whitespace character is a formula operator.
    const escape=(value:unknown)=>{
      const original=String(value??"");
      const safe=/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/u.test(original)?"'"+original:original;
      return `"${safe.replaceAll('"','""')}"`;
    };
    // An invalid legacy amount must never create a plausible but wrong Wave tax line.
    if(datedRows.some(({item})=>typeof item.amountCents!=="number"||!Number.isSafeInteger(item.amountCents)))
      return Response.json({error:"Saved expense amounts could not be verified. Review the records before exporting."},
        {status:503,headers:privateExpenseGetHeaders});
    // Whole-cent integer arithmetic avoids IEEE-754 rounding in large legacy amounts.
    const formatAmount=(cents:number)=>{
      const value=BigInt(Math.abs(cents));
      return (cents<0?"-":"")+String(value/BigInt(100))+"."+String(value%BigInt(100)).padStart(2,"0");
    };
    const csv=["Date,Category,Description,Amount,Customer,Job",...exportRows.map(({item,day})=>[day,item.category,item.description,formatAmount(item.amountCents),item.customer,item.service].map(escape).join(","))].join("\n");
    return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename=${selectedYear?`fire-expenses-${selectedYear}-wave.csv`:"fire-expenses-wave.csv"}`,...privateExpenseGetHeaders}});
    }
    return Response.json({expenses:rows.results},{headers:privateExpenseGetHeaders});
  }catch{
    return Response.json({error:"Expense records could not be read. Saved expenses were not changed."},
      {status:503,headers:privateExpenseGetHeaders});
  }
}


export async function POST(request:Request){if(!await authorized())return Response.json({error:"Unauthorized"},{status:401});const body=await request.json() as Record<string,unknown>;const description=String(body.description??"").trim();const amountCents=Math.round(Number(body.amountCents)||0);if(!description||!Number.isSafeInteger(amountCents)||amountCents<=0)return Response.json({error:"Description and a valid amount are required."},{status:400});const estimateId=String(body.estimateId??"").trim()||null;if(estimateId){const estimate=await env.DB.prepare("SELECT id FROM estimates WHERE id=?").bind(estimateId).first<{id:string}>();if(!estimate)return Response.json({error:"Job not found. Refresh before attaching this expense."},{status:404});}const rawIncurredAt=String(body.incurredAt??new Date().toISOString());const parsedIncurredAt=new Date(rawIncurredAt);if(Number.isNaN(parsedIncurredAt.getTime()))return Response.json({error:"Choose a valid expense date."},{status:400});const expense={id:crypto.randomUUID(),estimateId,category:String(body.category??"Supplies"),description,amountCents,incurredAt:parsedIncurredAt.toISOString(),createdAt:new Date().toISOString()};await env.DB.prepare("INSERT INTO expenses (id,estimate_id,category,description,amount_cents,incurred_at,created_at) VALUES (?,?,?,?,?,?,?)").bind(expense.id,expense.estimateId,expense.category,expense.description,expense.amountCents,expense.incurredAt,expense.createdAt).run();return Response.json({expense},{status:201});}
