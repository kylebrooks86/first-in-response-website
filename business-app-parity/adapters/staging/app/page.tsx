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
  const { recent, ...metrics } = await loadDashboardData(env.DB);
  return <Dashboard environment="STAGING" userName={user.fullName?.split(" ")[0]??"Kyle"} metrics={metrics} estimates={recent as never[]} />;
}
