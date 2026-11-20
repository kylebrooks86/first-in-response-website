import { env } from "cloudflare:workers";

type RuntimeEnv=Cloudflare.Env&{FIRE_ENV?:string;STAGING_SETUP_SECRET?:string};
export async function POST(request:Request){
 const runtime=env as RuntimeEnv;
 if(runtime.FIRE_ENV!=="staging"||!runtime.STAGING_SETUP_SECRET||request.headers.get("authorization")!==`Bearer ${runtime.STAGING_SETUP_SECRET}`)return Response.json({error:"Not available"},{status:404});
 const now=new Date().toISOString();
 const fixtures=[{id:"qa-mobile-layout",name:"QA Mobile Invoice",status:"completed",total:10000},{id:"qa-final",name:"QA Final Payment",status:"completed",total:10000},{id:"qa-deposit",name:"QA Deposit",status:"approved",total:15000}];
 const statements=[];
 for(const f of fixtures){
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO customers(id,name,email,phone,address,lead_source,created_at) VALUES (?,?,?,NULL,?,'QA synthetic',?)").bind(f.id,f.name,`${f.id}@example.test`,"123 Example St, Tulsa, OK",now));
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,share_token,accepted_at,signed_name,signed_at,contract_initials,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(f.id,f.id,f.status,f.total,f.total,Math.round(f.total/2),`${f.id}-staging-only`,now,"Synthetic QA",now,"QA",now));
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES (?,?,'Synthetic service','Sandbox QA only',1,'job',?)").bind(f.id,f.id,f.total));
 if(f.status==='completed'){
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,total_cents,share_token,created_at) VALUES (?,?,?,'sent',?,?,?,?)").bind(f.id,f.id,f.id,f.total,f.total,`${f.id}-invoice-staging-only`,now));
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO invoice_items(id,invoice_id,name,description,quantity,unit,total_cents) VALUES (?,?,'Synthetic service','Sandbox QA only',1,'job',?)").bind(f.id,f.id,f.total));
 }
 }
 await env.DB.batch(statements);
 return Response.json({fixtures:fixtures.map(f=>({name:f.name,estimate:`/estimate/${f.id}-staging-only`,invoice:f.status==='completed'?`/invoice/${f.id}-invoice-staging-only`:null}))});
}
