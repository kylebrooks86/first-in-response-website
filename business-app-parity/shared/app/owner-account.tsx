"use client";

export function OwnerAccountView({theme,onToggleTheme,environment="LIVE"}:{environment?:"LIVE"|"DOOMSDAY"|"STAGING"|"QA";theme:"light"|"dark";onToggleTheme:()=>void}) {
  return <div className="dashboard-view owner-account-view">
    <section className="welcome-row"><div><p className="eyebrow">FIRE Business App</p><h1>Owner Account</h1></div></section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Business</h2>
      <p><strong>First In Response Exteriors</strong> · Owner</p>
      <p>Phone: <a href="tel:+19189229366">(918) 922-9366</a></p>
      <p>Website: <a href="https://firstinresponseexteriors.com" target="_blank" rel="noopener noreferrer">firstinresponseexteriors.com</a></p>
      <p style={{fontSize:13,opacity:.75}}>Account details are view-only.</p>
    </section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Appearance</h2>
      <button type="button" className="brand-button" onClick={onToggleTheme}>Switch to {theme==="dark"?"light":"dark"} mode</button>
    </section>
    <section className="record-card" style={{padding:20}}>
      <h2>Environment &amp; access</h2>
      <p><strong>{environment} · FIRE Business App</strong></p>
      <p>Check the environment before entering customer or payment information. Records and payment settings stay separate.</p>
      <p>{(environment==="DOOMSDAY" || environment==="QA")?"Owner access uses this deployment’s signed-cookie authentication.":"Owner access remains protected by ChatGPT sign-in and owner-only checks."}</p>
      {(environment==="QA" || environment==="DOOMSDAY") && <div className="owner-account-session-actions"><a className="owner-account-signout" href="/api/auth/logout?return_to=%2F">Sign out of {environment}</a><p>Signs out of this environment only. Saved records are not deleted.</p></div>}
    </section>
  </div>;
}
