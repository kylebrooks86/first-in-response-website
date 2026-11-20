// Placeholder only. Never commit production Cloudflare Access signing keys here.
// The reviewed isolated TEST build script fetches the PUBLIC JWKS directly from
// the expected Cloudflare team certs endpoint and replaces this module locally.
// No private key, session cookie, token, owner email, or AUD belongs here.
export const pinnedAccessPublicKeys = Object.freeze({
  teamDomain: "",
  fetchedAt: 0,
  keys: []
});
