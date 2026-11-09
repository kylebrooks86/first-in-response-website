import {getFireAccessDiagnostic} from "../chatgpt-auth";

export const dynamic = "force-dynamic";
// This page is already under owner-only Cloudflare Access; a code is shown
// without exposing tokens, identity values, headers, secrets or business data.
export default async function AccessRequired(){
  const reason=await getFireAccessDiagnostic();
  return <main className="access-page"><div className="access-card">
    <h1>FIRE App — private access</h1>
    <p>A verified Cloudflare Access owner session is required. No business information was loaded.</p>
    <p><strong>Secure support code: {reason}</strong></p>
  </div></main>;
}
