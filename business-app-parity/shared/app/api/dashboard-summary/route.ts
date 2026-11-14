import { loadDashboardData } from "../../../lib/dashboard-data";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {COMPLETED_JOB_COUNT_SQL,completedJobCount} from "../../../lib/job-numbering.mjs";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary=await loadDashboardData(env.DB,env.FIRE_SERVICE_LOCATIONS_CANDIDATE==="synthetic-only");
  if((env as typeof env & {FIRE_JOB_NUMBERS_CANDIDATE?:string}).FIRE_JOB_NUMBERS_CANDIDATE!=='owner-approved-schema-v1')
    return Response.json(summary);
  const row=await env.DB.prepare(COMPLETED_JOB_COUNT_SQL).first<{completedJobs:number}>();
  const count=completedJobCount(row);
  if(count===null)return Response.json({error:'Completed-job count could not be verified.'},{status:503});
  return Response.json({...summary,completedJobs:count});
}
