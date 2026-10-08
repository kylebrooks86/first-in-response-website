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
previous = '<button type="button" className="sidebar-foot" onClick={() => { setTab("settings"); setMobileMenu(false); }} aria-label="Open account settings"><div className="owner-avatar">KB</div><div><strong>Kyle Brooks</strong><small>Owner · Account settings</small></div><ChevronRight /></button>'
new = '<button type="button" className="sidebar-foot" onClick={() => { setTab("owner-account"); setMobileMenu(false); }} aria-label="Open owner account"><div className="owner-avatar">KB</div><div><strong>Kyle Brooks</strong><small>Owner · Account</small></div><ChevronRight /></button>'
if new not in text:
    if text.count(previous) == 1:
        text = text.replace(previous, new)
    elif text.count(old) == 1:
        text = text.replace(old, new)
    else:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: owner row anchor mismatch")

avatar_old = 'onClick={() => setTab("settings")} aria-label="Open settings"'
avatar_new = 'onClick={() => setTab("owner-account")} aria-label="Open owner account"'
if avatar_new not in text:
    if text.count(avatar_old) != 1:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: avatar anchor mismatch")
    text = text.replace(avatar_old, avatar_new)

view_old = 'tab === "settings" ? <SettingsView/> : <EmptyView tab={tab} onSaved={handleSaved} />'
view_new = 'tab === "settings" ? <SettingsView/> : tab === "owner-account" ? <OwnerAccountView userName={userName}/> : <EmptyView tab={tab} onSaved={handleSaved} />'
if view_new not in text:
    if text.count(view_old) != 1:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: view anchor mismatch")
    text = text.replace(view_old, view_new)

component = '''function OwnerAccountView({userName}:{userName:string}) {
  return <section className="owner-account-page" aria-label="Owner account">
    <header><h1>Owner Account</h1><p>Account information for your FIRE Business App.</p></header>
    <div className="record-card">
      <div className="record-card-body">
        <div className="owner-avatar">KB</div>
        <h2>{userName || "Kyle Brooks"}</h2>
        <p>Owner · First In Response Exteriors</p>
        <p>Message Templates remain available separately from the main menu.</p>
      </div>
    </div>
  </section>;
}

'''
anchor = 'export function Dashboard({userName,metrics,estimates}'
if component not in text:
    if text.count(anchor) != 1:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: component anchor mismatch")
    text = text.replace(anchor, component + anchor)
dashboard.write_text(text)
print("DR_CUSTOMER_NAV_OWNER_SETTINGS=PASS")
print("DR_OWNER_ACCOUNT=PASS")
