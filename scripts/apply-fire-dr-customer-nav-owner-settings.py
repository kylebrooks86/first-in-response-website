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
text = text.replace('className="avatar-button" onClick={() => setTab("settings")} aria-label="Open settings"', 'className="avatar-button" onClick={() => setTab("owner-account")} aria-label="Open owner account"')
anchor = ' : tab === "settings" ? <SettingsView/> : <EmptyView tab={tab} onSaved={handleSaved} />'
replacement = ' : tab === "settings" ? <SettingsView/> : tab === "owner-account" ? <OwnerAccountView userName={userName} theme={theme} onToggleTheme={toggleTheme}/> : <EmptyView tab={tab} onSaved={handleSaved} />'
if replacement not in text:
    if text.count(anchor) != 1:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: tab renderer anchor mismatch")
    text = text.replace(anchor, replacement)
component = '''function OwnerAccountView({userName,theme,onToggleTheme}:{userName:string;theme:"light"|"dark";onToggleTheme:()=>void}) {
  return <div className="dashboard-view" style={{maxWidth:760}}>
    <section className="welcome-row"><div><p className="eyebrow">FIRE Business App</p><h1>Owner Account</h1><p>Profile, app preferences, and recovery environment.</p></div></section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Owner profile</h2>
      <p><strong>{userName}</strong> · Owner</p>
      <p>First In Response Exteriors</p>
      <p>Phone: (918) 922-9366</p>
      <p>Website: <a href="https://firstinresponseexteriors.com" target="_blank" rel="noopener noreferrer">firstinresponseexteriors.com</a></p>
      <p style={{fontSize:13,opacity:.75}}>Profile details are informational. Editing account identity is not enabled here.</p>
    </section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>App preferences</h2>
      <button type="button" className="brand-button" onClick={onToggleTheme}>Switch to {theme==="dark"?"light":"dark"} mode</button>
    </section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Environment</h2>
      <p><strong>DOOMSDAY · Independent staging</strong></p>
      <p>This recovery app is separate from the LIVE Business App. Confirm the environment before entering real customer or payment data.</p>
    </section>
    <section className="record-card" style={{padding:20}}>
      <h2>Security &amp; account management</h2>
      <p>PIN changes and account security are not available on this page yet. No insecure shortcuts have been added.</p>
    </section>
  </div>;
}

'''
if 'function OwnerAccountView(' not in text:
    anchor2 = 'export function Dashboard({userName,metrics,estimates}'
    if text.count(anchor2) != 1:
        raise SystemExit("DR_OWNER_ACCOUNT=FAIL: component insertion anchor mismatch")
    text = text.replace(anchor2, component + anchor2)
dashboard.write_text(text)
print("DR_CUSTOMER_NAV_OWNER_ACCOUNT=PASS")
