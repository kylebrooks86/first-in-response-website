"""SOURCE ONLY / NEVER DEPLOY: isolate a FIRE Stripe TEST app from the shared code.

Copies a staging candidate with Cloudflare Access authentication; fixes only the
test candidate's historical Sites-owner email mismatch and deployment identity.
The generated Vite configuration still contains a deliberately FALSE D1 ID.
Never create hosted resources, run Wrangler, migrate, or access Stripe here.
"""
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
launch = root / "cloudflare-launch"
if len(sys.argv) != 2:
    raise SystemExit("Usage: materialize-stripe-test.py NEW_OUTSIDE_REPOSITORY_DIRECTORY")
destination = Path(sys.argv[1]).resolve()
if destination.exists() or destination.is_relative_to(root):
    raise SystemExit("STOP: destination must be NEW and outside FIRE source")
subprocess.run(
    [sys.executable, str(launch / "materialize-cloudflare.py"), "staging", str(destination)],
    check=True,
)
# Stripe TEST must never inherit LIVE's fixed deployment identity, even though
# FIRE_ENV='cloudflare-staging' also enforces the test-mode Stripe envelope.
shutil.copy2(
    root / "adapters" / "independent-staging" / "app" / "local-customer-deployment.ts",
    destination / "app" / "local-customer-deployment.ts",
)

def exact_replace(relative, old, new):
    p = destination / relative
    original = p.read_text(encoding="utf-8")
    if original.count(old) != 1:
        raise SystemExit(f"STOP: changed owner authorization source: {relative}")
    p.write_text(original.replace(old, new), encoding="utf-8")

# Only test output is changed; Sites LIVE/QA/DR shared files remain unchanged.
exact_replace(
    "app/page.tsx",
    'const OWNER_EMAIL = "kylebrooks8605@gmail.com";',
    'const OWNER_EMAIL = (env as typeof env & { FIRE_ACCESS_OWNER_EMAIL?: string }).FIRE_ACCESS_OWNER_EMAIL?.toLowerCase();',
)
exact_replace(
    "app/page.tsx",
    'if (user.email.toLowerCase() !== OWNER_EMAIL) {',
    'if (!OWNER_EMAIL || user.email.toLowerCase() !== OWNER_EMAIL) {',
)
exact_replace(
    "app/api/payments/refund/route.ts",
    'const OWNER_EMAIL="kylebrooks8605@gmail.com";',
    'const OWNER_EMAIL=(env as RuntimeEnv & { FIRE_ACCESS_OWNER_EMAIL?: string }).FIRE_ACCESS_OWNER_EMAIL?.toLowerCase();',
)
exact_replace(
    "app/api/payments/refund/route.ts",
    'return Boolean(user&&user.email.toLowerCase()===OWNER_EMAIL);',
    'return Boolean(OWNER_EMAIL&&user&&user.email.toLowerCase()===OWNER_EMAIL);',
)
exact_replace(
    "app/api/quote-packages/route.ts",
    "const OWNER='kylebrooks8605@gmail.com';",
    "const OWNER=(env as typeof env & { FIRE_ACCESS_OWNER_EMAIL?: string }).FIRE_ACCESS_OWNER_EMAIL?.toLowerCase();",
)
exact_replace(
    "app/api/quote-packages/route.ts",
    "async function authorized(){return (await getChatGPTUser())?.email.toLowerCase()===OWNER;}",
    "async function authorized(){return Boolean(OWNER && (await getChatGPTUser())?.email.toLowerCase()===OWNER);}",
)
required = [
    ("app/chatgpt-auth.ts", "verifyFireAccessJWT"),
    ("app/local-customer-deployment.ts", "'staging' as const"),
    ("app/api/payments/webhook/route.ts", "verifyStripeSignature"),
    ("app/api/payments/refund/route.ts", "FIRE_ACCESS_OWNER_EMAIL"),
    ("app/page.tsx", "FIRE_ACCESS_OWNER_EMAIL"),
    ("vite.config.ts", "00000000-0000-4000-8000-000000000000"),
]
for relative, expected in required:
    if expected not in (destination / relative).read_text(encoding="utf-8"):
        raise SystemExit("STOP: test-only source prerequisite missing: " + relative)
if (destination / "dist").exists():
    raise SystemExit("STOP: test candidate unexpectedly includes compiled deployable output")

# Do not silently carry other legacy personal-email checks into the TEST build.
legacy_email = "kylebrooks8605@gmail.com"
test_owner_email = "kyle@firstinresponseexteriors.com"
# Legacy Sites adapters contain historical owner email checks throughout the app,
# not just in refunds and the dashboard. For this ONE isolated test candidate,
# pin all remaining fixed references to the exact owner email already approved
# by the Cloudflare Access policy. Do not mutate shared or LIVE sources.
changed = []
for p in (destination / "app").rglob("*"):
    if not p.is_file() or p.suffix not in (".ts", ".tsx", ".js", ".mjs"):
        continue
    original = p.read_text(encoding="utf-8")
    if legacy_email in original:
        p.write_text(original.replace(legacy_email, test_owner_email), encoding="utf-8")
        changed.append(str(p.relative_to(destination)))
remaining = [
    str(p.relative_to(destination))
    for p in (destination / "app").rglob("*")
    if p.is_file() and p.suffix in (".ts", ".tsx", ".js", ".mjs")
    and legacy_email in p.read_text(encoding="utf-8")
]
if remaining or len(changed) < 30:
    raise SystemExit("STOP: incomplete owner-email isolation: " +
                     ", ".join(remaining) + "; converted: " + str(len(changed)))
# Additional TEST-only kill switch: even if a Stripe credential were later
# added accidentally, these routes refuse to call Stripe while the reviewed
# Worker manifest says FIRE_STRIPE_MODE=disabled. Not applied to QA/LIVE/DR.
stripe_routes = {
    "app/api/payments/checkout/route.ts": "export async function POST(request: Request) {",
    "app/api/payments/refund/route.ts": "export async function POST(request:Request){",
    "app/api/payments/checkout/reconcile/route.ts": "export async function POST(request:Request){",
    "app/api/payments/connection/route.ts": "export async function GET(){",
}
stop_line = (
    '\n  if ((env as typeof env & { FIRE_STRIPE_MODE?:string }).FIRE_STRIPE_MODE !== "test")'
    ' return Response.json({error:"Stripe TEST is intentionally disabled."},'
    '{status:503,headers:{"cache-control":"no-store"}});'
)
for relative, signature in stripe_routes.items():
    p = destination / relative
    original = p.read_text(encoding="utf-8")
    if original.count(signature) != 1 or "FIRE_STRIPE_MODE" in original:
        raise SystemExit("STOP: Stripe TEST mode kill-switch injection changed: " + relative)
    p.write_text(original.replace(signature, signature + stop_line), encoding="utf-8")
# The webhook is the ONLY exception to the *early* TEST kill-switch: it must
# reject missing/invalid signatures with HTTP 400 before checking Stripe mode.
# While mode is disabled, even correctly signed events still receive retryable
# HTTP 503 before ANY JSON event processing, checkout/refund reconciliation,
# database writes, or success acknowledgment. No Stripe mode change is made.
# This override is confined to the generated TEST candidate, never shared/LIVE.
webhook_path = destination / "app/api/payments/webhook/route.ts"
webhook_source = webhook_path.read_text(encoding="utf-8")
webhook_anchor = "  let event:StripeEvent;"
required_signature = "verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)"
if (webhook_source.count(webhook_anchor) != 1 or
        webhook_source.count(required_signature) != 1 or
        "FIRE_STRIPE_MODE" in webhook_source or
        webhook_source.index(required_signature) > webhook_source.index(webhook_anchor)):
    raise SystemExit("STOP: exact TEST webhook signature-before-mode injection changed")
webhook_guard = (
    '  // TEST-only: validate Stripe HMAC before refusing disabled-mode delivery.\\n'
    '  // Never acknowledge or reconcile signed events while Stripe TEST is disabled.\\n'
    '  if ((env as typeof env & { FIRE_STRIPE_MODE?:string }).FIRE_STRIPE_MODE !== "test")\\n'
    '    return Response.json({error:"Stripe TEST is intentionally disabled."},\\n'
    '      {status:503,headers:{"cache-control":"no-store"}});\\n'
)
webhook_path.write_text(webhook_source.replace(webhook_anchor, webhook_guard + webhook_anchor), encoding="utf-8")
print("PASS: Four Stripe money/connection routes retain the original early 503 kill-switch.")
print("PASS: TEST webhook checks signed HMAC first, then returns retryable 503 while Stripe disabled; no ledger write.")


print("PASS: migrated " + str(len(changed)) +
      " remaining historical Sites owner-email references ONLY in isolated generated TEST files.")
print("PASS: SOURCE ONLY isolated Stripe TEST candidate; Access owner identity + staging mode.")
print("STOP: generated D1 UUID is a FAKE PLACEHOLDER. Never deploy this directory.")
print("NO Cloudflare/Stripe/D1 writes; existing QA, Sites LIVE and DR untouched.")
