import {
  clearedIndependentSessionCookie,
  revokeIndependentSession,
  safeRelativeReturnPath
} from "../../../owner-auth";

export async function GET(request: Request) {
  const returnTo = safeRelativeReturnPath(
    new URL(request.url).searchParams.get("return_to") || "/"
  );
  const privateHeaders = {
    "cache-control": "private, no-store",
    "vary": "Cookie",
    "x-content-type-options": "nosniff"
  };

  try {
    await revokeIndependentSession(request.headers.get("cookie"));
  } catch {
    return new Response("Logout could not be confirmed. Please retry.", {
      status: 503,
      headers: privateHeaders
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      ...privateHeaders,
      "location": "/login?return_to=" + encodeURIComponent(returnTo),
      "set-cookie": clearedIndependentSessionCookie()
    }
  });
}