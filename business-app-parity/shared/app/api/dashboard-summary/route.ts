import { loadDashboardData } from "../../../lib/dashboard-data";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {COMPLETED_JOB_COUNT_SQL,completedJobCount} from "../../../lib/job-numbering.mjs";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";
// Private metrics include customer/job and financial information; never let an
// intermediary or another session reuse a cached authenticated response.
const privateHeaders={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const privateJson=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return privateJson({ error: "Unauthorized" },401);
  }
  const summary=await loadDashboardData(env.DB,env.FIRE_SERVICE_LOCATIONS_CANDIDATE==="synthetic-only");
  if((env as typeof env & {FIRE_JOB_NUMBERS_CANDIDATE?:string}).FIRE_JOB_NUMBERS_CANDIDATE!=='owner-approved-schema-v1')
    return privateJson(summary);
  const row=await env.DB.prepare(COMPLETED_JOB_COUNT_SQL).first<{completedJobs:number}>();
  const count=completedJobCount(row);
  if(count===null)return privateJson({error:'Completed-job count could not be verified.'},503);
  return privateJson({...summary,completedJobs:count});
}
