import { loadDashboardData } from "../lib/dashboard-data";
import { env } from "cloudflare:workers";
import { Dashboard } from "./dashboard";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  if (user.email.toLowerCase() !== OWNER_EMAIL) {
    return <main className="access-page"><div className="access-card"><img className="access-logo" src="/fire-app-logo.png" alt="First In Response Exteriors" /><h1>Private FIRE app</h1><p>This account does not have access to Kyle&apos;s business records.</p><a href={chatGPTSignOutPath("/")}>Sign out and use Kyle&apos;s account</a></div></main>;
  }
  if ((env as typeof env & { FIRE_QA_SYNTHETIC_ONLY?: string }).FIRE_QA_SYNTHETIC_ONLY !== "enabled") {
    return <main><h1>FIRE QA disabled</h1></main>;
  }
  const { recent, ...metrics } = await loadDashboardData(env.DB,env.FIRE_SERVICE_LOCATIONS_CANDIDATE==="synthetic-only");
  return <><div role="status" style={{background:"#601818",color:"#fff",padding:"10px",textAlign:"center",fontWeight:700}}>SYNTHETIC QA ONLY · NO REAL CUSTOMERS OR PAYMENTS</div><Dashboard localCustomersCandidate={(env as typeof env & { FIRE_LOCAL_CUSTOMERS_CANDIDATE?: string }).FIRE_LOCAL_CUSTOMERS_CANDIDATE === "synthetic-only"} environment="QA" userName={user.fullName?.split(" ")[0]??"Kyle"} metrics={metrics} estimates={recent as never[]} /></>;
}
