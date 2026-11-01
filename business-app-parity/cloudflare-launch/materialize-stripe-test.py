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
for p in (destination / "app").rglob("*"):
    if p.is_file() and p.suffix in (".ts", ".tsx", ".js", ".mjs") and legacy_email in p.read_text(encoding="utf-8"):
        raise SystemExit("STOP: unresolved legacy LIVE owner email in TEST app code: " + str(p.relative_to(destination)))

print("PASS: SOURCE ONLY isolated Stripe TEST candidate; Access owner identity + staging mode.")
print("STOP: generated D1 UUID is a FAKE PLACEHOLDER. Never deploy this directory.")
print("NO Cloudflare/Stripe/D1 writes; existing QA, Sites LIVE and DR untouched.")
