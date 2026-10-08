"use client";

export function OwnerAccountView({theme,onToggleTheme,environment="LIVE"}:{environment?:"LIVE"|"DOOMSDAY"|"STAGING";theme:"light"|"dark";onToggleTheme:()=>void}) {
  return <div className="dashboard-view owner-account-view">
    <section className="welcome-row"><div><p className="eyebrow">FIRE Business App</p><h1>Owner Account</h1><p>Profile, business contact information, and app preferences.</p></div></section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Owner profile</h2>
      <p><strong>Kyle Brooks</strong> · Owner</p>
      <p>First In Response Exteriors</p>
      <p>Business phone: <a href="tel:+19189229366">(918) 922-9366</a></p>
      <p>Website: <a href="https://firstinresponseexteriors.com" target="_blank" rel="noopener noreferrer">firstinresponseexteriors.com</a></p>
      <p style={{fontSize:13,opacity:.75}}>Profile details are informational. Editing account identity is not enabled here.</p>
    </section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>App preferences</h2>
      <button type="button" className="brand-button" onClick={onToggleTheme}>Switch to {theme==="dark"?"light":"dark"} mode</button>
    </section>
    <section className="record-card" style={{padding:20,marginBottom:16}}>
      <h2>Environment</h2>
      <p><strong>{environment} · FIRE Business App</strong></p>
      <p>Confirm the environment before entering customer or payment data. Each deployment keeps its own records and payment configuration.</p>
    </section>
    <section className="record-card" style={{padding:20}}>
      <h2>Security &amp; account management</h2>
      <p>{environment==="DOOMSDAY"?"Owner access uses the independent deployment’s existing signed-cookie authentication.":"Owner access remains protected by ChatGPT sign-in and the existing owner-only checks."}</p>
    </section>
  </div>;
}

