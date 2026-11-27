/**
 * FIRE Cloudflare Access customer-link policy CONTRACT ONLY. No policy writes.
 * Tokenized customer routes must work without owner login. Private owner routes
 * must remain under signed, owner-only Access. Provider verification is separate.
 */
export const REQUIRED_PUBLIC_ACCESS_PATHS=Object.freeze([
  '/estimate/*',
  '/invoice/*',
  '/pay/*',
  '/api/public/estimates/*/accept',
  '/api/public/estimates/*/change-request',
  '/api/public/estimates/*/revised-accept',
  '/api/payments/checkout',
  '/fire-app-logo.png',
  '/favicon.ico',
  '/_next/static/*',
  '/assets/*',
]);
export const OWNER_ONLY_PATH_SAMPLES=Object.freeze([
  '/', '/settings', '/api/customers', '/api/estimates', '/api/invoices',
  '/api/payments', '/api/payments/refund', '/api/payments/checkout/reconcile',
  '/api/notifications', '/api/backup', '/api/restore',
  '/api/auth/login', '/api/stripe/webhook', '/api/payments/webhook',
]);
function blocked(message){throw Error('FIRE PUBLIC ACCESS BLOCKED: '+message);}
function pathsEqual(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
/** Offline approximation only; actual Cloudflare matching must be verified. */
export function accessPathPatternMatches(pattern,path){
  if(typeof pattern!=='string'||typeof path!=='string')return false;
  const regex='^'+pattern.split('*').map(escapeRe).join('.*')+'$';
  return new RegExp(regex).test(path);
}
export function verifyPublicAccessOverrides(overrides){
  if(!Array.isArray(overrides)||overrides.length!==REQUIRED_PUBLIC_ACCESS_PATHS.length)
    blocked('Exactly the reviewed customer and static asset exceptions are required');
  const paths=[];
  for(const o of overrides){
    if(!o||typeof o!=='object'||Array.isArray(o)
      ||Object.keys(o).sort().join(',')!=='behavior,path_pattern'
      ||o.behavior!=='public'||typeof o.path_pattern!=='string')
      blocked('Each override must contain only an exact public path pattern');
    paths.push(o.path_pattern);
  }
  const expected=[...REQUIRED_PUBLIC_ACCESS_PATHS].sort();
  if(!pathsEqual([...paths].sort(),expected)||new Set(paths).size!==paths.length)
    blocked('Unreviewed, missing, duplicate or overbroad Access bypass');
  for(const privatePath of OWNER_ONLY_PATH_SAMPLES)
    if(paths.some(path=>accessPathPatternMatches(path,privatePath)))
      blocked('Owner or payment-administration path exposed: '+privatePath);
  return Object.freeze({status:'CUSTOMER_PATH_POLICY_READY_FOR_PROVIDER_REVIEW',
    exceptions:paths.length,providerConfigured:false,customerLinksTested:false,
    ownerRoutesVerifiedPrivate:false,assetsVerified:false,publicationAuthorized:false});
}
export function reviewedPublicAccessOverrides(){
  return REQUIRED_PUBLIC_ACCESS_PATHS.map(path_pattern=>({behavior:'public',path_pattern}));
}
