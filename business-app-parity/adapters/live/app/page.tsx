import { loadDashboardData } from "../lib/dashboard-data";
import {COMPLETED_JOB_COUNT_SQL,completedJobCount} from "../lib/job-numbering.mjs";
import { env } from "cloudflare:workers";
import { Dashboard } from "./dashboard";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  if (user.email.toLowerCase() !== OWNER_EMAIL) {
    return <main className="access-page"><div className="access-card"><img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" /><h1>Private FIRE app</h1><p>This account does not have access to First In Response Exteriors business records.</p><a href={chatGPTSignOutPath("/")}>Sign out and use the authorized owner account</a></div></main>;
  }
  const { recent, ...baseMetrics } = await loadDashboardData(env.DB,env.FIRE_SERVICE_LOCATIONS_CANDIDATE==="synthetic-only");
  // All materialized environments must match /api/dashboard-summary. Distinct
  // permanent jobs, not quote revisions or only the eight visible cards.
  const enabled=(env as typeof env & {FIRE_JOB_NUMBERS_CANDIDATE?:string}).FIRE_JOB_NUMBERS_CANDIDATE==='owner-approved-schema-v1';
  const row=enabled?await env.DB.prepare(COMPLETED_JOB_COUNT_SQL).first<{completedJobs:number}>():null;
  const completed=enabled?completedJobCount(row):null;
  if(enabled&&completed===null)throw Error('Completed-job count could not be verified.');
  const metrics=enabled?{...baseMetrics,completedJobs:completed!}:baseMetrics;
  return <Dashboard localCustomersCandidate={process.env.NODE_ENV === "development" && (env as typeof env & { FIRE_LOCAL_CUSTOMERS_CANDIDATE?: string }).FIRE_LOCAL_CUSTOMERS_CANDIDATE === "synthetic-only"} userName="First In Response Exteriors" metrics={metrics} estimates={recent as never[]} />;
}
