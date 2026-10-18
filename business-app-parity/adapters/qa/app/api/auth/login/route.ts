import { env } from "cloudflare:workers";
import { independentSessionCookie, verifyIndependentPassword } from "../../../owner-auth";

type RateLimitRow = { attempts: number; windowStartedAt: number; blockedUntil: number };
const WINDOW_SECONDS = 15 * 60;
const BLOCK_SECONDS = 30 * 60;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

async function rateLimitKey(request: Request) {
  const runtime = env as Cloudflare.Env & { FIRE_QA_SESSION_SECRET?: string };
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${runtime.FIRE_QA_SESSION_SECRET || "missing"}:${address}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimitStatus(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT attempts,window_started_at AS windowStartedAt,blocked_until AS blockedUntil FROM auth_rate_limits WHERE key=?")
    .bind(key).first<RateLimitRow>();
  if (!row) return { blocked: false, retryAfter: 0 };
  const retryAfter = Math.max(0, Number(row.blockedUntil) - now);
  return { blocked: retryAfter > 0, retryAfter };
}

async function recordFailure(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  const now = Math.floor(Date.now() / 1000);
  // Increment in one statement so simultaneous failures cannot overwrite each other.
  const row = await env.DB.prepare(`INSERT INTO auth_rate_limits (key,attempts,window_started_at,blocked_until)
    VALUES (?,1,?,0) ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN window_started_at+?<=? THEN 1 ELSE attempts+1 END,
    window_started_at=CASE WHEN window_started_at+?<=? THEN ? ELSE window_started_at END,
    blocked_until=CASE WHEN blocked_until>? THEN blocked_until
      WHEN window_started_at+?<=? THEN 0
      WHEN attempts+1>=? THEN ? ELSE 0 END
    RETURNING blocked_until AS blockedUntil`)
    .bind(key, now, WINDOW_SECONDS, now, WINDOW_SECONDS, now, now,
      now, WINDOW_SECONDS, now, MAX_ATTEMPTS, now + BLOCK_SECONDS).first<{ blockedUntil: number }>();
  if (!row) throw new Error("Login protection failed to record the attempt.");
  const blockedUntil = Number(row.blockedUntil);
  return blockedUntil > now ? blockedUntil - now : 0;
}

async function clearFailures(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE key=?").bind(key).run();
}

export async function POST(request: Request) {
  let stage = "rate-key";
  try {
    const key = await rateLimitKey(request);
    stage = "rate-read";
    const status = await rateLimitStatus(key);
    if (status.blocked) {
      return Response.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "cache-control": "no-store", "retry-after": String(status.retryAfter) } });
    }
    stage = "body-parse";
    const body = await request.json() as { password?: string };
    stage = "password-verify";
    if (typeof body?.password !== "string" || body.password.length < 24 || body.password.length > 128 || !await verifyIndependentPassword(body.password)) {
      stage = "failure-record";
      const retryAfter = await recordFailure(key);
      return Response.json({ error: retryAfter ? "Too many sign-in attempts. Try again later." : "Incorrect QA passphrase." }, { status: retryAfter ? 429 : 401, headers: { "cache-control": "no-store", ...(retryAfter ? { "retry-after": String(retryAfter) } : {}) } });
    }
    stage = "clear-failures";
    await clearFailures(key);
    stage = "session-cookie";
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": await independentSessionCookie() } });
  } catch (error) {
    // Operational diagnostics only: never log passphrases, cookies, IPs,
    // hash values, SQL text, request bodies, or arbitrary exception messages.
    const message = error instanceof Error ? error.message : "";
    const code = message.match(/\b(?:SQLITE_BUSY|SQLITE_LOCKED|SQLITE_ERROR|D1_ERROR|D1_EXEC_ERROR|D1_TYPE_ERROR)\b/)?.[0]
      || (message === "Login protection failed to record the attempt." ? "EMPTY_RETURNING_ROW" : "UNCLASSIFIED");
    console.error("QA sign-in protection unavailable", { stage, name: error instanceof Error ? error.name : "UnknownError", code });
    return Response.json({ error: "Sign-in protection is temporarily unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
