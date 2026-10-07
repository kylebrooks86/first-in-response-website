from pathlib import Path

nav = Path("app/customer-portal-nav.tsx")
nav.write_text('''"use client";

// Customer documents never show owner-only Back/Home navigation.
export function CustomerPortalNav() {
  return null;
}
''')

dashboard = Path("app/dashboard.tsx")
text = dashboard.read_text()
old = '<div className="sidebar-foot"><div className="owner-avatar">KB</div><div><strong>Kyle Brooks</strong><small>Owner</small></div><ChevronRight /></div>'
new = '<button type="button" className="sidebar-foot" onClick={() => { setTab("settings"); setMobileMenu(false); }} aria-label="Open account settings"><div className="owner-avatar">KB</div><div><strong>Kyle Brooks</strong><small>Owner · Account settings</small></div><ChevronRight /></button>'
if new not in text:
    if text.count(old) != 1:
        raise SystemExit("DR_CUSTOMER_NAV_OWNER_SETTINGS=FAIL: owner row anchor mismatch")
    text = text.replace(old, new)
    dashboard.write_text(text)
print("DR_CUSTOMER_NAV_OWNER_SETTINGS=PASS")
