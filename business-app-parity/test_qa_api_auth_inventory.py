"""FIRE QA source-only owner API route inventory, not an authorization proof.

Runs without environment credentials, cloud access, database or network.
A newly added route must receive explicit security review; it cannot silently
inherit "private" or "public" status. Existing customer-link endpoints are
intentionally public-by-token and are not represented as owner-authenticated.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).parent / "shared" / "app" / "api"
# Explicit public boundary. Token and signing validation on these routes is
# covered separately by real-route tests; this only inventories their existence.
PUBLIC = {
    "app-version/route.ts": "Non-sensitive build version endpoint",
    "payments/checkout/route.ts": "Customer share-token checkout; QA denies all Stripe actions",
    "payments/webhook/route.ts": "Stripe HMAC signed callback; QA denies all events",
    "public/estimates/[token]/accept/route.ts": "Public customer agreement, exact private share token",
    "public/estimates/[token]/change-request/route.ts": "Public customer change request with private token",
    "public/estimates/[token]/revised-accept/route.ts": "Public revision approval with private token",
}
# Keep this count pinned to the audited QA source snapshot. A new API route
# must receive owner/security review before it can count toward any gate.
EXPECTED_ROUTE_COUNT = 67
EXPECTED_PUBLIC_COUNT = len(PUBLIC)
HANDLER = re.compile(r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(")
OWNER_CALL = re.compile(
    r"(?:getChatGPTUser\s*\(|getOwnerUser\s*\(|"
    r"authorized\s*\(|owner\s*\(|requireChatGPTUser\s*\(|requireOwner\s*\()"
)
DENY = re.compile(r"(?:\b401\b|\bUnauthorized\b|\bunauthorized\b|\b403\b)")
SENSITIVE = re.compile(r"(?:env\.DB|\.prepare\s*\(|\.batch\s*\(|BUCKET\.get\s*\(|BUCKET\.put\s*\()")

def review():
    paths = sorted(ROOT.rglob("route.ts"))
    failures = []
    if len(paths) != EXPECTED_ROUTE_COUNT:
        failures.append(f"Route inventory changed: {len(paths)} observed, {EXPECTED_ROUTE_COUNT} reviewed.")
    if not all((ROOT / p).is_file() for p in PUBLIC):
        failures.append("One or more explicitly documented public routes changed or disappeared.")
    methods = 0
    private_methods = 0
    public_methods = 0
    for path in paths:
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        src = path.read_text(encoding="utf-8")
        funcs = list(HANDLER.finditer(src))
        if not funcs:
            failures.append(f"{rel}: no recognized HTTP method exported.")
            continue
        if rel in PUBLIC:
            public_methods += len(funcs)
            continue
        for i, m in enumerate(funcs):
            method = m.group(1)
            methods += 1
            private_methods += 1
            # Scan only the entry body, not shared imports or a later handler.
            # Look for both an explicit authentication call and a denial path.
            entry = src[m.end():funcs[i+1].start() if i+1<len(funcs) else len(src)]
            # A route's first 1,800 chars must establish private auth; helper
            # implementation may be defined above the method, but call happens here.
            head = entry[:1800]
            owner = OWNER_CALL.search(head)
            deny = DENY.search(head)
            if not owner or not deny:
                failures.append(f"{rel} {method}: no evident early owner-authorization + denial boundary.")
                continue
            sensitive = SENSITIVE.search(head)
            if sensitive and sensitive.start() < owner.start():
                failures.append(f"{rel} {method}: sensitive storage call appears before owner-auth entry.")
    if failures:
        print("FIRE QA OWNER API ROUTE INVENTORY: REVIEW REQUIRED", file=sys.stderr)
        for failure in failures:
            print("STOP: " + failure, file=sys.stderr)
        return 2
    print(f"PASS: {len(paths)} route files reviewed; {private_methods} owner-only entry methods; {public_methods} deliberately public-by-token/signature/version methods.")
    print("BOUNDARY: Static entrypoint inventory ONLY; does not verify valid sessions, public-token scope, D1 bindings or deployed code.")
    print("NO CLOUD ACCESS, WRITES, PAYMENT, CUSTOMER DATA OR RELEASE GATE CHANGES.")
    return 0

if __name__ == "__main__":
    raise SystemExit(review())
