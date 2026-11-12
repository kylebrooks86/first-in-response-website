import { env } from "cloudflare:workers";
import { independentSessionCookie, verifyIndependentPassword } from "../../../owner-auth";

type RateLimitRow = { attempts: number; windowStartedAt: number; blockedUntil: number };
const WINDOW_SECONDS = 15 * 60;
const BLOCK_SECONDS = 30 * 60;
const MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

async function rateLimitKey(request: Request) {
  const runtime = env as Cloudflare.Env & { FIRE_SESSION_SECRET?: string };
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${runtime.FIRE_SESSION_SECRET || "missing"}:${address}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rateLimitStatus(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT attempts,window_started_at AS windowStartedAt,blocked_until AS blockedUntil FROM auth_rate_limits WHERE key=?")
    .bind(key).first<RateLimitRow>();
  if (!row || Number(row.windowStartedAt) + WINDOW_SECONDS <= now) return { blocked: false, retryAfter: 0 };
  const retryAfter = Math.max(0, Number(row.blockedUntil) - now);
  return { blocked: retryAfter > 0, retryAfter };
}

async function recordFailure(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT attempts,window_started_at AS windowStartedAt,blocked_until AS blockedUntil FROM auth_rate_limits WHERE key=?")
    .bind(key).first<RateLimitRow>();
  const resetWindow = !row || Number(row.windowStartedAt) + WINDOW_SECONDS <= now;
  const attempts = resetWindow ? 1 : Number(row.attempts) + 1;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? now + BLOCK_SECONDS : 0;
  await env.DB.prepare(`INSERT INTO auth_rate_limits (key,attempts,window_started_at,blocked_until)
    VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`)
    .bind(key, attempts, resetWindow ? now : Number(row?.windowStartedAt ?? now), blockedUntil).run();
  return blockedUntil > now ? blockedUntil - now : 0;
}

async function clearFailures(key: string) {
  if (!env.DB) throw new Error("Login protection requires the D1 database.");
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE key=?").bind(key).run();
}

export async function POST(request: Request) {
  try {
    const key = await rateLimitKey(request);
    const status = await rateLimitStatus(key);
    if (status.blocked) {
      return Response.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "cache-control": "no-store", "retry-after": String(status.retryAfter) } });
    }
    const body = await request.json() as { password?: string };
    if (!await verifyIndependentPassword(String(body.password ?? ""))) {
      const retryAfter = await recordFailure(key);
      return Response.json({ error: retryAfter ? "Too many sign-in attempts. Try again later." : "Incorrect password." }, { status: retryAfter ? 429 : 401, headers: { "cache-control": "no-store", ...(retryAfter ? { "retry-after": String(retryAfter) } : {}) } });
    }
    await clearFailures(key);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": await independentSessionCookie() } });
  } catch {
    return Response.json({ error: "Sign-in protection is temporarily unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
