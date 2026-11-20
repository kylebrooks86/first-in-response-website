import { FIRE_APP_VERSION } from "../../../lib/app-version";
import { quickUnlockEnabled } from "../../owner-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { version: FIRE_APP_VERSION, quickAuthMode: quickUnlockEnabled() ? "pin-or-passkey" : "legacy" },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
