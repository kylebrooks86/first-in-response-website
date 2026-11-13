import { FIRE_APP_VERSION } from "../../../lib/app-version";
import { quickUnlockEnabled } from "../../owner-auth";

// The QA login screen must see the same nonsecret login mode as its server.
// Without this adapter, the shared default endpoint returns only "version"
// and silently hides Face ID / fingerprint / PIN even when enabled.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { version: FIRE_APP_VERSION, quickAuthMode: quickUnlockEnabled() ? "pin-or-passkey" : "legacy" },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
