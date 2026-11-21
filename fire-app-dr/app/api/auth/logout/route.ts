import { clearedIndependentSessionCookie, safeRelativeReturnPath } from "../../../owner-auth";

export async function GET(request: Request) {
  const returnTo = safeRelativeReturnPath(new URL(request.url).searchParams.get("return_to") || "/");
  return new Response(null, { status: 303, headers: { "location": "/login?return_to=" + encodeURIComponent(returnTo), "set-cookie": clearedIndependentSessionCookie(), "cache-control": "no-store" } });
}
