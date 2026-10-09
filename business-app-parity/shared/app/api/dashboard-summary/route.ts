import { loadDashboardData } from "../../../lib/dashboard-data";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await loadDashboardData(env.DB));
}
