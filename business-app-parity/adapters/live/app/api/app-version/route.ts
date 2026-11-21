import { FIRE_APP_VERSION } from "../../../lib/app-version";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { version: FIRE_APP_VERSION },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
