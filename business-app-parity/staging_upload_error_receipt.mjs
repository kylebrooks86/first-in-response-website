// Offline-only receipt formatter for a future separately reviewed upload helper.
// No filesystem, environment, network, upload, lock change, or CLI invocation.
// Inputs must stay in memory. Output contains only fixed labels and bounded numbers.
export function classifyUploadFailure(output,exitCode,stage){
  const raw=typeof output==="string"?output:"";
  const s=raw.slice(0,2_000_000).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,"");
  const categories=[];
  const checks=[["BINDING_CONFLICT",/\b(?:binding|secret|variable)\b[^\r\n]{0,120}\b(?:conflict|already exists|duplicate|already defined)\b/i],["AUTH_OR_PERMISSION",/\b(?:unauthorized|forbidden|authentication error|permission denied|not authorized)\b/i],["CLI_ARGUMENT",/\b(?:unknown argument|unrecognized argument|unknown option|unexpected argument)\b/i],["CONFIG_VALIDATION",/\b(?:invalid configuration|configuration error|validation error|invalid wrangler configuration)\b/i],["NETWORK",/\b(?:ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed)\b/i],["ASSET_SESSION",/assets-upload-session/i],["VERSION_ENDPOINT",/\/workers\/scripts\/[^/\s"'?]+\/versions\b/i],["ERROR_MARKER",/\[ERROR\]|\bERROR:/i]];
  for(const [name,re] of checks)if(re.test(s))categories.push(name);
  const providerCodes=[...new Set([...s.matchAll(/\[\s*code\s*:\s*(\d{4,6})\s*\]/gi)].map(m=>Number(m[1])))].slice(0,8);
  const httpStatuses=[...new Set([...s.matchAll(/\b(?:HTTP(?:\/[12](?:\.\d)?)?\s+|HTTP\s+status\s*[:=]?\s*|status(?:Code)?\s*[:=]\s*)([45]\d{2})\b/gi)].map(m=>Number(m[1])))].slice(0,8);
  return {stage:["CLI_EXIT","VERSION_ID_PARSE","POST_UPLOAD_READBACK"].includes(stage)?stage:"UNKNOWN",exitCode:Number.isInteger(exitCode)&&exitCode>=-2147483648&&exitCode<=2147483647?exitCode:null,outputTruncated:raw.length>s.length&&raw.length>2_000_000,categories:categories.length?categories:["UNCLASSIFIED"],providerCodes,httpStatuses};
}
